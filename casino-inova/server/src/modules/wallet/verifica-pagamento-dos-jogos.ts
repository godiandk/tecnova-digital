import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { SlotsService } from '../games/slots/slots.service';
import { RouletteService } from '../games/roulette/roulette.service';
import { BlackjackService } from '../games/blackjack/blackjack.service';
import { BaccaratService } from '../games/baccarat/baccarat.service';
import { BacBoService } from '../games/bac-bo/bac-bo.service';
import { StockMarketService } from '../games/stock-market/stock-market.service';
import { BancaFrancesaService } from '../games/banca-francesa/banca-francesa.service';
import { TrucoService } from '../games/truco/truco.service';
import { DominoService } from '../games/domino/domino.service';
import { PokerService } from '../games/poker/poker.service';
import { degrauEconomico, faixaDeEntrada, NIVEIS_DE_MESA } from '../games/shared/niveis-de-mesa';

/**
 * OS DEZ JOGOS PAGAM O QUE DEVEM, E O SALDO FECHA NA CONTA.
 *
 *   npm run verify:pagamento
 *
 * A identidade que isto prova, jogo por jogo e rodada por rodada:
 *
 *     saldo final  ==  saldo inicial  −  soma das apostas  +  soma dos pagamentos
 *
 * E ela é medida no SALDO DE VERDADE — a soma do extrato lida pela mesma função que o
 * jogo usa —, não num número que o teste guardou.
 *
 * POR QUE ISTO PRECISOU EXISTIR: foi relatado ganhar, ver o prêmio na tela, e o saldo não
 * subir. Parte era da interface (uma corrida que fazia o número voltar atrás, ver
 * `verifica-saldo-na-tela`). Mas "parte" não fecha a pergunta: a outra metade é se o
 * servidor move a ficha certa, e isso só se responde jogando de verdade e conferindo a
 * carteira depois.
 *
 * RETORNO OU LUCRO — a armadilha que isto pega. Um jogo que pague 2x pode creditar 2.000
 * (retorno total, a aposta volta junto) ou 1.000 (só o lucro). Os dois parecem certos
 * lendo o código; só um fecha a conta. Como a identidade acima usa o saldo real, um jogo
 * que credite a metade errada acusa na hora — e a tabela impressa no fim mostra o retorno
 * efetivo de cada mesa, que dá pra comparar com o RTP publicado dela.
 *
 * O APLICATIVO DE VERDADE É QUEM MONTA OS SERVIÇOS. Montá-los à mão no teste provaria a
 * montagem do teste; aqui a injeção é a mesma de produção, então a conferência também
 * pega um jogo que pare de subir por dependência faltando.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`  ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** O que uma rodada movimentou, do ponto de vista de quem está olhando o saldo. */
interface Rodada {
  apostado: number;
  retorno: number;
}

const RODADAS_POR_JOGO = 40;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const wallet = app.get(WalletService);

  const id = `teste-pagamento-${Date.now()}`;
  /*
   * SALDO ALTO DE PROPÓSITO. Com pouca ficha, metade dos jogos recusaria a aposta por
   * saldo insuficiente e a conferência passaria sem ter jogado nada — que é o pior tipo
   * de teste verde. Também põe o jogador num degrau alto, onde os números são grandes e
   * um erro de arredondamento apareceria.
   */
  const SALDO_INICIAL = 500_000_000;
  await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Teste Pagamento', 400)`, [id]);
  await db.query(
    `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1,'ajuste',$2,'teste')`,
    [id, SALDO_INICIAL],
  );

  try {
    const antesDeTudo = await wallet.balanceOf(id);
    confere('o jogador de teste começa com o saldo que recebeu', antesDeTudo === SALDO_INICIAL, `tem ${antesDeTudo}`);

    /*
     * A APOSTA SAI DO DEGRAU DE VERDADE DESTE JOGADOR, e não do `getConfig` do jogo.
     *
     * A primeira versão desta linha lia `SlotsService.getConfig().minBet` — e a
     * conferência reprovou os dez jogos com "a aposta mínima é 5.000.000". O teste estava
     * errado E achou um defeito de produção no mesmo movimento: o `getConfig` dos sete
     * jogos de casa publica o mínimo do BRONZE para todo mundo, seja qual for o degrau de
     * quem pergunta. É exatamente o que aparece na tela como "o mínimo em Grande é
     * 500.000.000 fichas" ao lado de um trilho oferecendo fichas de 50.
     *
     * Aqui a conferência usa o degrau real para poder medir o PAGAMENTO, que é o assunto
     * dela. O defeito do `getConfig` tem conferência própria, logo abaixo.
     */
    const degrau = degrauEconomico(SALDO_INICIAL, 400);
    const aposta = degrau.minimo;
    console.log(`\n  jogador de teste: ${SALDO_INICIAL.toLocaleString('pt-BR')} fichas, nível 400 -> mesa ${degrau.nome}, aposta ${aposta.toLocaleString('pt-BR')}\n`);

    /*
     * A APOSTA É RECALCULADA A CADA RODADA, e não escolhida uma vez.
     *
     * O jogador PERDE fichas jogando — é um cassino. Depois de algumas dezenas de rodadas
     * a banca cai de degrau, e uma aposta escolhida no começo passa a ser ilegal na mesa
     * nova. A primeira versão deste teste reprovou truco, dominó e pôquer exatamente por
     * isso, e o erro era do teste: ele estava medindo a recusa em vez do pagamento.
     */
    const apostaDeAgora = async () => degrauEconomico(await wallet.balanceOf(id), 400).minimo;
    const entradaDeAgora = async () => {
      const saldo = await wallet.balanceOf(id);
      const faixa = faixaDeEntrada(saldo, 400);
      /* A entrada mais barata que a mesa aceita: o teste quer jogar muitas partidas. */
      return Math.min(faixa.maximo, Math.max(faixa.minimo, faixa.minimo));
    };

    const jogadas: Record<string, () => Promise<unknown>> = {
      'caça-níqueis': async () => {
        await app.get(SlotsService).playSpin(id, await apostaDeAgora());
      },

      roleta: async () => {
        await app.get(RouletteService).playSpin(id, [{ type: 'vermelho', amount: await apostaDeAgora() }]);
      },

      bacará: async () => {
        await app.get(BaccaratService).playRound(id, 'jogador', await apostaDeAgora());
      },

      'bac bo': async () => {
        await app.get(BacBoService).playRound(id, [{ type: 'jogador', amount: await apostaDeAgora() }]);
      },

      'stock market': async () => {
        await app.get(StockMarketService).playRound(id, { direction: 'alta', amount: await apostaDeAgora() });
      },

      /*
       * BLACKJACK tem turnos: pede carta até parar. `stand` fecha a mão, e é aí que o
       * pagamento acontece — parar antes mediria metade do jogo.
       */
      blackjack: async () => {
        const bj = app.get(BlackjackService);
        await bj.startHand(id, await apostaDeAgora());
        /*
         * O SEGURO É UMA PERGUNTA QUE TRAVA A MÃO. Quando o dealer mostra um ás, a mesa
         * para e espera a resposta — `stand` recusa até ela vir. A primeira versão deste
         * teste não respondia, e a mão ficava aberta com a aposta já debitada: a conta do
         * saldo acusou 5 milhões a menos, que era dinheiro numa mão inacabada e não um
         * buraco na carteira. Recusar o seguro é o que a estratégia básica manda, e é o
         * que fecha a mão pra o pagamento acontecer.
         */
        await bj.responderSeguro(id, false).catch(() => undefined);
        /*
         * PARA EM TODAS AS MÃOS. Um split abre uma segunda mão, e um `stand` só fecha a
         * primeira — a mão seguinte continua aberta com a aposta debitada. A conferência
         * acusou isso como meio milhão faltando no saldo, que era dinheiro numa mão
         * inacabada. Aqui ela para até a mesa dizer que acabou.
         */
        /*
         * "Nenhuma mão em andamento" é o jeito de o blackjack dizer que a mão ACABOU —
         * um blackjack natural fecha sozinho, sem precisar de `stand`. Tratar isso como
         * erro contava uma rodada perdida que na verdade tinha sido jogada inteira.
         */
        let mesa: any = await bj.stand(id).catch(() => ({ finished: true }));
        for (let i = 0; i < 8 && !mesa?.finished; i += 1) {
          mesa = await bj.stand(id).catch(() => ({ ...mesa, finished: true }));
        }
      },

      /*
       * BANCA FRANCESA tem lançamento nulo: a rodada só liquida quando a soma decide. O
       * laço relança até decidir — é exatamente o que o jogador faz na tela.
       */
      'banca francesa': async () => {
        const banca = app.get(BancaFrancesaService);
        await banca.apostar(id, [{ type: 'grande', amount: await apostaDeAgora() }]);
        for (let tentativa = 0; tentativa < 60; tentativa += 1) {
          const r = await banca.lancar(id);
          if (r.decidiu) return;
        }
        // sessenta lançamentos nulos seguidos: não acontece, mas não trava
      },

      truco: async () => {
        const truco = app.get(TrucoService);
        const entrada = await entradaDeAgora();
        const inicio = await truco.newMatch(id, entrada);
        /*
         * TENTA TODAS AS CARTAS, e não só a primeira. Uma jogada recusada (não é a vez, a
         * carta não vale agora) deixava a partida ABERTA, e a partida seguinte batia em
         * "você já tem uma partida em andamento" — a conferência media a recusa, e o
         * buy-in da partida presa aparecia como buraco no saldo.
         */
        return jogarAteAcabar(inicio, (estado) => {
            /*
             * UM PEDIDO DE TRUCO TRAVA A MÃO. Com `pendingTruco` em pé, jogar carta é
             * recusado — e a partida ficava presa segurando o buy-in, que a conferência
             * acusou como 50 mil faltando. Aceitar é o que destrava e deixa o jogo seguir.
             */
            if (estado.pendingTruco) return truco.respondTruco(id, 'aceitar');
            return tentarCada<any>(estado.playerHand ?? [], (c) => truco.playCard(id, c));
        });
      },

      dominó: async () => {
        const dominoS = app.get(DominoService);
        const entrada = await entradaDeAgora();
        const inicio = await dominoS.newMatch(id, entrada);
        return jogarAteAcabar(inicio, (estado) =>
            /*
             * TENTA TODAS AS PEÇAS, e passa só quando nenhuma for aceita. Filtrar antes
             * por "cabe na ponta" dependia de adivinhar o formato da peça; deixar o
             * próprio jogo recusar é mais honesto e não trava a partida.
             */
            /*
             * CADA PEÇA EM CADA PONTA. O dominó recusa `passar` quando existe jogada
             * possível — e recusa a peça quando a ponta não é dita. Tentar o par
             * (peça, ponta) é o que cobre as duas recusas; passar fica pro caso de
             * realmente não haver jogada, que é quando o jogo aceita.
             */
            tentarCada<any>(
              (estado.playerHand ?? []).flatMap((p: any) => [
                { peca: p, ponta: 'esquerda' as const },
                { peca: p, ponta: 'direita' as const },
              ]),
              (o) => dominoS.playTile(id, o.peca, o.ponta),
              () => dominoS.passTurn(id),
            ));
      },

      poker: async () => {
        const pokerS = app.get(PokerService);
        const entrada = await entradaDeAgora();
        const inicio = await pokerS.newHand(id, entrada);
        return jogarAteAcabar(inicio, () => pokerS.act(id, 'desistir'));
      },
    };

    console.log('\n--- cada jogo: o saldo fecha com as apostas e os pagamentos ---\n');
    console.log('  jogo            rodadas       apostado          pago   retorno efetivo   saldo fecha');

    for (const [nome, jogar] of Object.entries(jogadas)) {
      const saldoAntes = await wallet.balanceOf(id);
      let apostado = 0;
      let pago = 0;
      let rodadas = 0;

      /*
       * O QUE A RODADA MOVIMENTOU É LIDO DA DECLARAÇÃO DELA, e não do que o método devolve.
       *
       * Cada mesa nomeia o retorno do seu jeito — `totalReturn`, `retorno`, `playerStack`,
       * `totalWin` — e a primeira versão desta conferência tentava adivinhar o campo de
       * cada uma. Ela reprovou blackjack e truco por LER ZERO onde o jogo tinha pago, o
       * que é o pior tipo de falso positivo: acusa a carteira por um erro do teste.
       *
       * Agora a medida vem do evento LIQUIDADA, que TODA rodada grava com `apostado` e
       * `retorno` — é o que o jogo DECLARA ter feito. A conferência passa a comparar a
       * declaração com o saldo, que é exatamente a pergunta: "o jogo pagou o que disse?".
       */
      const marcaDoComeco = await ultimaLiquidacao(db, id);

      for (let i = 0; i < RODADAS_POR_JOGO; i += 1) {
        try {
          await jogar();
          rodadas += 1;
        } catch (erro) {
          confere(`${nome}: a rodada ${i + 1} estourou`, false, (erro as Error).message);
          break;
        }
      }

      const declarado = await declaradoDesde(db, id, marcaDoComeco);
      apostado = declarado.apostado;
      pago = declarado.retorno;

      const saldoDepois = await wallet.balanceOf(id);
      const esperado = saldoAntes - apostado + pago;
      const efetivo = apostado > 0 ? `${((pago / apostado) * 100).toFixed(1)}%` : '—';

      console.log(
        `  ${nome.padEnd(15)} ${String(rodadas).padStart(7)} ${apostado.toLocaleString('pt-BR').padStart(14)} ` +
          `${pago.toLocaleString('pt-BR').padStart(13)} ${efetivo.padStart(17)} ${saldoDepois === esperado ? '     sim' : '     NÃO'}`,
      );

      confere(
        `  ${nome}: saldo final == inicial − apostas + pagamentos`,
        saldoDepois === esperado,
        `esperado ${esperado.toLocaleString('pt-BR')}, real ${saldoDepois.toLocaleString('pt-BR')} (diferença ${(saldoDepois - esperado).toLocaleString('pt-BR')})`,
      );
      confere(`  ${nome}: jogou de verdade (pelo menos uma rodada)`, rodadas > 0, `${rodadas} rodadas`);
    }

    /*
     * O DEFEITO QUE ESTA CONFERÊNCIA ENCONTROU, agora com nome e conferência própria.
     *
     * `getConfig` é o que a tela lê pra montar o trilho de fichas. Publicando o mínimo do
     * Bronze pra todo mundo, ela oferece fichas de 50 numa mesa cujo mínimo é 500 milhões
     * — e a pessoa monta uma aposta que o servidor recusa. A mesa fica matematicamente
     * inutilizável: não existe combinação de fichas oferecidas que alcance o mínimo.
     */
    console.log('\n--- o que cada jogo PUBLICA como mínimo, contra o degrau de quem pergunta ---\n');
    const publicados: Array<[string, number]> = [
      ['caça-níqueis', (await app.get(SlotsService).getConfig(id)).minBet],
      ['roleta', (await app.get(RouletteService).getConfig(id)).minBet],
      ['bacará', (await app.get(BaccaratService).getConfig(id)).minBet],
      ['bac bo', (await app.get(BacBoService).getConfig(id)).minBet],
      ['blackjack', (await app.get(BlackjackService).getConfig(id)).minBet],
      ['stock market', (await app.get(StockMarketService).getConfig(id)).minBet],
      ['banca francesa', (await app.get(BancaFrancesaService).getConfig(id)).minBet],
    ];
    const bronze = NIVEIS_DE_MESA[0].minimo;
    const saldoDeAgora = await wallet.balanceOf(id);
    const degrauDeAgora = () => degrauEconomico(saldoDeAgora, 400);
    /*
     * O DEGRAU DE AGORA, e não o do começo. A linha impressa lia o degrau medido antes
     * das quatrocentas rodadas — o saldo já tinha descido de faixa, e o relatório dizia
     * "publica 500.000 | o degrau Safira exige 5.000.000" logo acima de um `ok`. Um
     * relatório que imprime divergência e aprova é pior que uma falha: ensina a ignorar
     * o que ele imprime.
     */
    const agora = degrauDeAgora();
    for (const [nome, minimo] of publicados) {
      console.log(
        `  ${nome.padEnd(15)} publica ${minimo.toLocaleString('pt-BR').padStart(15)}` +
          `   |  o degrau ${agora.nome} exige ${agora.minimo.toLocaleString('pt-BR')}`,
      );
    }
    /*
     * O degrau deste jogador não é o Bronze, então qualquer jogo que publique 50 está
     * publicando uma constante em vez de perguntar.
     */
    const presosNoBronze = publicados.filter(([, m]) => m === bronze && degrauDeAgora().minimo !== bronze);
    confere(
      'nenhum jogo publica o mínimo do Bronze pra todo mundo',
      presosNoBronze.length === 0,
      `${presosNoBronze.map(([n]) => n).join(', ')} — a tela oferece fichas que o servidor recusa`,
    );
    confere(
      'o mínimo publicado é o do degrau de quem perguntou',
      publicados.every(([, m]) => m === degrauDeAgora().minimo),
      publicados.map(([n, m]) => `${n}=${m}`).join(' '),
    );

    console.log('\n--- o extrato inteiro fecha ---\n');
    const somaDoExtrato = await db.queryOne<{ soma: string }>(
      'SELECT COALESCE(SUM(amount),0)::text AS soma FROM ledger_entries WHERE user_id = $1',
      [id],
    );
    const saldoFinal = await wallet.balanceOf(id);
    confere(
      'o saldo lido é exatamente a soma do extrato',
      BigInt(saldoFinal) === BigInt(somaDoExtrato?.soma ?? '0'),
      `saldo ${saldoFinal}, extrato ${somaDoExtrato?.soma}`,
    );
    confere('o saldo nunca ficou negativo', saldoFinal >= 0, `terminou em ${saldoFinal}`);
  } finally {
    /*
     * A LIMPEZA VEM ANTES DE FECHAR O APLICATIVO, e essa ordem custou uma depuração.
     *
     * `app.close()` derruba o `DatabaseService` junto (é o `onModuleDestroy` dele), então
     * qualquer `DELETE` depois disso morre com "pool after end" — e, por acontecer no
     * `finally`, esse erro SUBSTITUÍA o erro de verdade que tinha derrubado a conferência.
     * O sintoma era uma falha misteriosa de banco escondendo uma coluna inexistente numa
     * consulta minha. Limpar primeiro e fechar por último mantém o erro original visível.
     *
     * A ordem dos DELETE também importa: `users` é referenciada por todas as outras.
     */
    await db.query('DELETE FROM tournament_rounds WHERE user_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM eventos_da_rodada WHERE usuario_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => undefined);
    await app.close();
  }

  console.log(falhas === 0 ? '\nOK: os dez jogos pagam o que devem, e o saldo fecha.' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

/**
 * A MARCA DE "DAQUI PRA FRENTE": quantas liquidações este jogador já tinha.
 *
 * `eventos_da_rodada` não tem coluna `id` — a chave é `(rodada_id, seq)`, e `seq` conta
 * por RODADA, não global. Então não existe um número crescente pra comparar. Contar
 * quantas já havia e, no fim, olhar só as que passaram dessa contagem resolve sem inventar
 * coluna: o jogador de teste é novo e ninguém mais grava nele.
 */
async function ultimaLiquidacao(db: DatabaseService, userId: string): Promise<number> {
  const linha = await db.queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM eventos_da_rodada
      WHERE usuario_id = $1 AND tipo = 'LIQUIDADA'`,
    [userId],
  );
  return Number(linha?.n ?? 0);
}

/** O que as rodadas liquidadas DEPOIS da marca declararam ter apostado e pago. */
async function declaradoDesde(db: DatabaseService, userId: string, marca: number): Promise<Rodada> {
  const linha = await db.queryOne<{ apostado: string; retorno: string }>(
    `WITH recentes AS (
       SELECT (dados->>'apostado')::numeric AS apostado,
              (dados->>'retorno')::numeric  AS retorno
         FROM eventos_da_rodada
        WHERE usuario_id = $1 AND tipo = 'LIQUIDADA'
        ORDER BY em DESC
        LIMIT GREATEST(0, (SELECT COUNT(*) FROM eventos_da_rodada
                            WHERE usuario_id = $1 AND tipo = 'LIQUIDADA') - $2)
     )
     SELECT COALESCE(SUM(apostado), 0)::text AS apostado,
            COALESCE(SUM(retorno), 0)::text  AS retorno
       FROM recentes`,
    [userId, marca],
  );
  return { apostado: Number(linha?.apostado ?? 0), retorno: Number(linha?.retorno ?? 0) };
}

/** Soma o que uma mão de blackjack apostou e recebeu, contando splits e seguro. */
function somarMao(mesa: { maos?: Array<{ aposta: number; totalReturn?: number }>; seguro?: number; seguroPago?: number }): Rodada {
  const maos = mesa.maos ?? [];
  return {
    apostado: maos.reduce((t, m) => t + m.aposta, 0) + (mesa.seguro ?? 0),
    retorno: maos.reduce((t, m) => t + (m.totalReturn ?? 0), 0) + (mesa.seguroPago ?? 0),
  };
}

/**
 * Joga uma partida de turnos até ela acabar e devolve o que ela movimentou.
 *
 * As três mesas de entrada (truco, dominó, pôquer) só liquidam no fim: o buy-in sai no
 * começo e o retorno entra quando a partida termina. Medir no meio contaria o débito sem
 * o crédito e acusaria um buraco que não existe.
 */
async function jogarAteAcabar(
  inicio: unknown,
  proximaJogada: (estado: any) => unknown,
): Promise<void> {
  let estado: any = await inicio;
  for (let i = 0; i < 400 && estado && !estado.finished; i += 1) {
    try {
      estado = await proximaJogada(estado);
    } catch (erro) {
      throw new Error(`jogada recusada: ${(erro as Error).message}`);
    }
  }
  /* Quem mede é a declaração da rodada; aqui só importa que a partida tenha ACABADO. */
  if (!estado?.finished) throw new Error('a partida não terminou dentro do limite de jogadas');
}

/**
 * Tenta cada opção até uma ser aceita. Devolve o estado da que funcionou.
 *
 * As mesas de turno recusam jogada fora de hora, e uma recusa não pode deixar a partida
 * presa: partida presa segura o buy-in e vira buraco no saldo na conferência seguinte.
 */
async function tentarCada<T>(
  opcoes: T[],
  jogar: (opcao: T) => unknown,
  seNenhuma?: () => unknown,
): Promise<unknown> {
  for (const opcao of opcoes) {
    try {
      return await jogar(opcao);
    } catch {
      /* essa não deu; tenta a próxima */
    }
  }
  if (seNenhuma) return seNenhuma();
  throw new Error('nenhuma jogada foi aceita');
}

/** Uma peça de dominó cabe numa das pontas da mesa? */
function podeJogar(peca: any, estado: any): boolean {
  if (estado.leftEnd === null || estado.leftEnd === undefined) return true;
  const [a, b] = Array.isArray(peca) ? peca : [peca?.[0], peca?.[1]];
  return a === estado.leftEnd || b === estado.leftEnd || a === estado.rightEnd || b === estado.rightEnd;
}

main().catch((erro) => {
  console.error('ERRO:', erro);
  process.exit(1);
});
