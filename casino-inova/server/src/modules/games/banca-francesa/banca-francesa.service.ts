import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BancaFrancesaBet, lancar, resolveBets, theoreticalRtp } from './banca-francesa.engine';
import {
  BET_TYPES,
  MAX_SIMULTANEOUS_BETS,
  NOME_DA_CASA,
  PISO_EM_MINIMOS,
  TETO_EM_MINIMOS,
  TOTAL_RETURN_MULTIPLIER,
  WINNING_SUMS,
  limitesDaCasa,
  problemaComApostaDaBanca,
  riscoDaAposta,
} from './banca-francesa.config';
import { NIVEIS_DE_MESA, nivelPara } from '../shared/niveis-de-mesa';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
import { LANCAMENTOS_GUARDADOS, LancamentoNoPlacar, montarPlacar } from './placar-da-banca';
import { RodadaSolo, podeLancar, podeMexerNaAposta, rodadaNova } from './rodada-solo';

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'banca-francesa';

@Injectable()
export class BancaFrancesaService {
  /** O placar da mesa: todos os lançamentos, decisivos e nulos, na ordem. */
  private readonly lancamentos: LancamentoNoPlacar[] = [];

  /**
   * A rodada aberta de cada jogador.
   *
   * Fica em memória porque, enquanto a rodada não decide, NENHUMA ficha se mexeu — o
   * pior que uma reinicialização do servidor faz é o jogador ter que encostar as fichas
   * de novo. Nada de dinheiro depende disto: o que depende de dinheiro está no ledger,
   * que é banco e é append-only.
   */
  private readonly rodadas = new Map<string, RodadaSolo>();

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  /** O placar DESTA mesa: dados, somas e nulos. Ver placar-da-banca.ts. */
  getPlacar() {
    return montarPlacar(this.lancamentos);
  }

  /**
   * A configuração do jogo, com os limites do nível de entrada (Bronze).
   *
   * Quem quiser saber o PRÓPRIO limite pergunta em `/niveis/meu` mais o multiplicador
   * daqui — esta rota é pública e não sabe quem está perguntando.
   */
  getConfig() {
    const minimoDeEntrada = NIVEIS_DE_MESA[0].minimo;
    return {
      minBet: minimoDeEntrada,
      maxSimultaneousBets: MAX_SIMULTANEOUS_BETS,
      betTypes: BET_TYPES,
      nomeDaCasa: NOME_DA_CASA,
      winningSums: WINNING_SUMS,
      totalReturnMultiplier: TOTAL_RETURN_MULTIPLIER,
      /*
       * O RTP É POR TIPO DE APOSTA, e a tela mostra o do tipo escolhido. Centro e
       * linha têm RTP diferente (98,41% e 99,21%) porque na linha metade do dinheiro
       * nem chega a jogar — mostrar um número só seria errado pra um dos dois.
       */
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((t) => [t, theoreticalRtp(t)])),
      /*
       * OS LIMITES VÃO EM MÚLTIPLOS DO MÍNIMO, e não em fichas.
       *
       * O mínimo depende do degrau em que o jogador está, e o degrau depende do saldo.
       * Mandar "o máximo em Ases é 300" seria verdade só pra quem está no Bronze; em
       * múltiplos, a mesma resposta serve pra mesa de 50 e pra de 500 milhões, e a tela
       * faz a conta com o mínimo que ela já recebeu de `/niveis/meu`.
       */
      pisoEmMinimos: PISO_EM_MINIMOS,
      tetoEmMinimos: TETO_EM_MINIMOS,
      /** Os limites já em fichas, pro nível de entrada — pra tela pública mostrar algo. */
      limitesNoNivelDeEntrada: Object.fromEntries(
        BET_TYPES.map((t) => [t, limitesDaCasa(t, minimoDeEntrada)]),
      ),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* A rodada                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * O estado autoritativo da rodada deste jogador.
   *
   * É o que a tela pede ao reconectar. Nenhuma decisão do cliente sobrevive a uma
   * recarga: o que vale é o que está aqui.
   */
  async rodadaParaOCliente(userId: string) {
    /*
     * A ROTA DEVOLVE A RODADA JÁ TRADUZIDA, com mínimo, fichas, limites e as contas
     * feitas. Ela devolvia o objeto cru — sem esses campos —, e a tela caía no padrão
     * de 50: numa conta de cento e sete bilhões, o trilho oferecia ficha de 50 e o
     * servidor recusava a aposta por estar abaixo do mínimo. O defeito só aparecia
     * jogando, porque a rodada em si estava certa; o que faltava era o que ela conta.
     */
    return this.paraOCliente(this.rodadaDe(userId), await this.walletService.balanceOf(userId));
  }

  rodadaDe(userId: string): RodadaSolo {
    const existente = this.rodadas.get(userId);
    if (existente) return existente;
    const nova = rodadaNova(randomUUID());
    this.rodadas.set(userId, nova);
    return nova;
  }

  /**
   * Confirma as apostas. NÃO cobra nada.
   *
   * Só a partir daqui o botão de lançar existe — e o servidor confere de novo, no
   * lançamento, que as apostas continuam válidas e cabem no saldo. Confirmar não
   * reserva ficha: o jogador pode confirmar, ir pra outra tela, voltar e mexer.
   */
  async apostar(userId: string, bets: BancaFrancesaBet[]) {
    const rodada = this.rodadaDe(userId);
    if (!podeMexerNaAposta(rodada.estado)) {
      throw new BadRequestException('Esta rodada já foi liquidada. Comece uma nova.');
    }

    const saldo = await this.walletService.balanceOf(userId);
    this.conferirApostas(bets, saldo);

    rodada.apostas = bets;
    rodada.estado = 'APOSTAS_CONFIRMADAS';
    /* Mexeu na aposta: o aviso do nulo sai da tela, porque a decisão já foi tomada. */
    rodada.esperandoDepoisDoNulo = false;
    return this.paraOCliente(rodada, saldo);
  }

  /** Tira as fichas da mesa. Não custa nada — nenhuma ficha saiu do saldo ainda. */
  async retirar(userId: string) {
    const rodada = this.rodadaDe(userId);
    if (!podeMexerNaAposta(rodada.estado)) {
      throw new BadRequestException('Esta rodada já foi liquidada. Comece uma nova.');
    }
    rodada.apostas = [];
    rodada.estado = 'APOSTAS_ABERTAS';
    rodada.esperandoDepoisDoNulo = false;
    return this.paraOCliente(rodada, await this.walletService.balanceOf(userId));
  }

  /**
   * UM LANÇAMENTO. Um só, por ação do jogador.
   *
   * Se a soma não decidir (4, 8 a 13, 17, 18), a rodada PARA: os dados ficam à vista, as
   * apostas continuam de pé, ninguém foi cobrado e o estado volta pra ABERTAS — o
   * jogador mexe no que quiser e lança de novo quando quiser. Não existe relançamento
   * automático.
   *
   * Se decidir, aí sim o dinheiro se mexe, e tudo de uma vez dentro de `umaVezSo`:
   * debita o risco, paga o retorno, pontua o torneio. Repetir o mesmo pedido devolve a
   * mesma liquidação em vez de sortear outra vez.
   */
  async lancar(userId: string, actionId?: string) {
    const rodada = this.rodadaDe(userId);
    if (!podeLancar(rodada.estado)) {
      throw new BadRequestException(
        rodada.apostas.length === 0
          ? 'Encoste uma ficha no pano e confirme antes de lançar.'
          : 'Confirme a aposta antes de lançar.',
      );
    }

    const saldo = await this.walletService.balanceOf(userId);
    /*
     * CONFERE DE NOVO NO LANÇAMENTO. As apostas foram validadas ao confirmar, mas o
     * saldo pode ter mudado desde então (outro jogo noutra aba, um prêmio de torneio,
     * uma compra). O que vale é o saldo de agora.
     */
    this.conferirApostas(rodada.apostas, saldo);

    const { dice, sum, outcome } = lancar();
    const lancamento: LancamentoNoPlacar = {
      rollId: randomUUID(),
      dice: [dice[0], dice[1], dice[2]],
      sum,
      outcome: outcome ?? 'nulo',
      createdAt: new Date().toISOString(),
    };
    this.guardarNoPlacar(lancamento);

    if (!outcome) {
      /*
       * LANÇAMENTO NULO. Nada de dinheiro acontece: nem débito, nem prêmio, nem
       * pontuação de torneio. A rodada continua sendo a MESMA (o rodadaId não muda) e
       * volta a aceitar mexida na aposta.
       */
      /*
       * O ESTADO CONTINUA SENDO 'APOSTAS_CONFIRMADAS'. As fichas ficam na mesa, do
       * jeito que a pessoa deixou, e ela pode mexer OU lançar de novo direto — mexer já
       * é permitido em CONFIRMADAS. Voltar pra ABERTAS obrigaria a reconfirmar uma
       * aposta que ninguém tirou da mesa, e "manter" viraria uma tarefa.
       */
      rodada.nulos.push(lancamento);
      rodada.esperandoDepoisDoNulo = true;
      return {
        lancamento,
        decidiu: false as const,
        rodada: this.paraOCliente(rodada, saldo),
        placar: this.getPlacar(),
      };
    }

    return this.acoes.umaVezSo(userId, actionId, async () => {
      const apostas = rodada.apostas;
      const results = resolveBets(outcome, apostas);
      const riscoTotal = apostas.reduce((t, b) => t + riscoDaAposta(b.type, b.amount), 0);
      const totalStake = apostas.reduce((t, b) => t + b.amount, 0);
      const totalReturn = results.reduce((t, r) => t + r.totalReturn, 0);

      /*
       * O DÉBITO É O VALOR CHEIO DAS FICHAS, e o retorno já traz de volta a parte da
       * linha que nunca esteve em risco. Debitar só o risco e pagar só o prêmio daria a
       * mesma conta no fim, mas o extrato ficaria mentindo sobre o tamanho da aposta:
       * quem pôs 100 na linha veria "apostou 50", e não foi isso que ele fez.
       */
      await this.walletService.debit(userId, totalStake, 'aposta', GAME_ID, actionId, rodada.rodadaId);
      if (totalReturn > 0) {
        await this.walletService.credit(
          userId,
          totalReturn,
          'premio',
          GAME_ID,
          undefined,
          rodada.rodadaId,
        );
      }
      /* O torneio pontua pelo RISCO, que é o que a pessoa de fato pôs em jogo. */
      await this.tournaments.recordRound(userId, GAME_ID, riscoTotal, totalReturn);

      rodada.estado = 'LIQUIDADA';
      /*
       * A MARCA DO NULO SAI QUANDO A RODADA DECIDE. Sem esta linha, a rodada liquidada
       * continuava carregando `esperandoDepoisDoNulo: true` de um lançamento anterior —
       * e a faixa "LANÇAMENTO NULO" ficava na tela POR CIMA de um resultado que já
       * tinha saído, com o botão ainda dizendo "Jogar novamente". A rodada acabou; nada
       * está esperando decisão nenhuma.
       */
      rodada.esperandoDepoisDoNulo = false;
      const liquidada = { ...rodada };
      /* A próxima rodada nasce limpa, com identificador novo. */
      this.rodadas.set(userId, rodadaNova(randomUUID()));

      return {
        lancamento,
        decidiu: true as const,
        results,
        totalStake,
        riscoTotal,
        totalReturn,
        /** O que sobrou de verdade: retorno menos o que saiu. Pode ser negativo. */
        lucroLiquido: totalReturn - totalStake,
        newBalance: await this.walletService.balanceOf(userId),
        rodada: this.paraOCliente(liquidada, await this.walletService.balanceOf(userId)),
        placar: this.getPlacar(),
      };
    });
  }

  /* ---------------------------------------------------------------------- */

  /**
   * As apostas cabem nas regras E no bolso?
   *
   * Duas conferências diferentes, e a ordem importa: primeiro cada aposta contra os
   * limites da casa dela (que é o que a pessoa acabou de fazer), depois a soma dos
   * RISCOS contra o saldo. O risco, e não o valor cheio: quem põe 100 na linha só pode
   * perder 50, então exigir 100 de saldo recusaria uma aposta que cabe.
   */
  private conferirApostas(bets: BancaFrancesaBet[], saldo: number) {
    if (!Array.isArray(bets) || bets.length === 0) {
      throw new BadRequestException('Encoste pelo menos uma ficha no pano.');
    }
    if (bets.length > MAX_SIMULTANEOUS_BETS) {
      throw new BadRequestException(`Só existem ${MAX_SIMULTANEOUS_BETS} lugares na mesa.`);
    }

    const minimoDaMesa = nivelPara(saldo).minimo;
    const vistos = new Set<string>();
    for (const bet of bets) {
      if (!BET_TYPES.includes(bet.type)) {
        throw new BadRequestException(`Tipo de aposta inválido: ${bet.type}.`);
      }
      if (vistos.has(bet.type)) {
        throw new BadRequestException(`Aposta em "${bet.type}" duplicada — some tudo numa aposta só.`);
      }
      vistos.add(bet.type);

      const problema = problemaComApostaDaBanca(bet.type, bet.amount, minimoDaMesa);
      if (problema) throw new BadRequestException(problema);
    }

    const risco = bets.reduce((t, b) => t + riscoDaAposta(b.type, b.amount), 0);
    if (risco > saldo) {
      throw new BadRequestException(
        `Você tem ${saldo.toLocaleString('pt-BR')} fichas — esta aposta arrisca ${risco.toLocaleString('pt-BR')}.`,
      );
    }
  }

  private guardarNoPlacar(lancamento: LancamentoNoPlacar) {
    this.lancamentos.push(lancamento);
    if (this.lancamentos.length > LANCAMENTOS_GUARDADOS) this.lancamentos.shift();
  }

  /**
   * A rodada do jeito que o cliente precisa dela: com as contas já feitas.
   *
   * O risco e o retorno possível são calculados AQUI, no servidor, e não na tela. É a
   * mesma razão de sempre — número que o cliente calcula é número que o cliente pode
   * calcular errado, e este em particular é o que a pessoa olha antes de decidir.
   */
  private paraOCliente(rodada: RodadaSolo, saldo: number) {
    const nivel = nivelPara(saldo);
    const minimoDaMesa = nivel.minimo;
    const totalApostado = rodada.apostas.reduce((t, b) => t + b.amount, 0);
    const risco = rodada.apostas.reduce((t, b) => t + riscoDaAposta(b.type, b.amount), 0);

    /*
     * O RETORNO POSSÍVEL é o do MELHOR resultado — não a soma de todos os pagamentos.
     * Só um resultado sai por lançamento, então somar Ases com Grande anunciaria um
     * prêmio que não existe em cenário nenhum.
     */
    const retornoPossivel = Math.max(
      0,
      ...(['ases', 'pequeno', 'grande'] as const).map((o) =>
        resolveBets(o, rodada.apostas).reduce((t, r) => t + r.totalReturn, 0),
      ),
    );

    return {
      rodadaId: rodada.rodadaId,
      estado: rodada.estado,
      apostas: rodada.apostas,
      nulos: rodada.nulos,
      esperandoDepoisDoNulo: rodada.esperandoDepoisDoNulo,
      abertaEm: rodada.abertaEm,
      totalApostado,
      risco,
      retornoPossivel,
      saldo,
      saldoDepoisDaAposta: saldo - risco,
      minimoDaMesa,
      /*
       * AS FICHAS DO TRILHO VÊM COM A RODADA, e não de uma segunda chamada.
       *
       * A tela pedia isto a `/niveis/meu` separado, e bastou uma reescrita esquecer de
       * passar a lista pra o trilho voltar a oferecer ficha de 50 numa conta de cento e
       * sete bilhões — a pessoa montava a aposta e o servidor recusava por estar abaixo
       * do mínimo. Duas fontes pro mesmo fato é uma a mais.
       */
      nomeDoNivel: nivel.nome,
      fichas: nivel.fichas,
      limites: Object.fromEntries(BET_TYPES.map((t) => [t, limitesDaCasa(t, minimoDaMesa)])),
    };
  }
}
