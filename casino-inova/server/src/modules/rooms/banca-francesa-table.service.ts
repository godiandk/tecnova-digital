import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';
import { BancaFrancesaBet, BetResult, DecisiveOutcome, Lancamento, lancar, resolveBets } from '../games/banca-francesa/banca-francesa.engine';
import {
  BET_TYPES,
  JANELA_ENTRE_LANCAMENTOS_MS,
  LANCAMENTOS_MAXIMOS_COM_JANELA,
  MAX_SIMULTANEOUS_BETS,
} from '../games/banca-francesa/banca-francesa.config';
import { NIVEIS_DE_MESA, nivelPara, problemaComAAposta } from '../games/shared/niveis-de-mesa';
import { MAX_SEATS, PLAYER_COLORS, PlayerColor } from './player-colors';
import { generateTableCode } from './table-code';
import { umDe } from '../games/shared/rng';
import { RelogioDaSala } from '../games/core/relogio-da-sala';
import { RegistroDeEventos } from '../games/core/registro-de-eventos';
import { aceitaAposta } from '../games/core/fases';

export type TableVisibility = 'publica' | 'privada';

export interface TableSeat {
  userId: string;
  name: string;
  isBot: boolean;
  color: PlayerColor;
  pendingBets: BancaFrancesaBet[];
}

export interface RoundResult {
  dice: number[];
  sum: number;
  outcome: 'ases' | 'pequeno' | 'grande';
  /**
   * Quantas vezes os dados voltaram pro copo antes de sair uma soma que decide.
   *
   * Das 216 combinações de três dados só 63 resolvem alguma coisa (1 de Ases, 31 de
   * Pequeno, 31 de Grande); as outras — 4, 8 a 13, 17 e 18 — não decidem nada e o
   * lançamento se repete com as apostas em pé. Isso é regra do jogo, não detalhe de
   * implementação: é o que calibra o RTP.
   *
   * O motor já contava isso em `rollUntilDecisive()` e a tela de um jogador só já
   * mostrava ("relançou 2x até decidir"), mas aqui o número era descartado na
   * desestruturação e nunca chegava a quem joga na mesa. Quem estava na mesa via só a
   * jogada final, mesmo quando os dados hesitaram três ou quatro vezes. Escondido não
   * é neutro: é informação verdadeira do jogo que sumia no caminho.
   */
  rerolls: number;
  /** Os lançamentos nulos, pra a tela poder mostrar os dados rolando de verdade. */
  lancamentosNulos: number[][];
  bySeat: Record<string, { results: BetResult[]; totalStake: number; totalReturn: number }>;
  at: string;
}

export interface BancaFrancesaTable {
  id: string;
  code: string;
  visibility: TableVisibility;
  hostUserId: string;
  seats: TableSeat[];
  lastRound?: RoundResult;
  /**
   * A fase da mesa agora é de verdade, não implícita. Antes dava pra apostar a qualquer
   * momento, inclusive enquanto o anfitrião girava — a aposta entrava no `pendingBets`
   * no meio da apuração e ninguém percebia.
   */
  relogio: RelogioDaSala;
  /** Identifica a rodada no log de eventos e no extrato. */
  rodadaId: string;
  rodadasJogadas: number;
  /**
   * Os lançamentos JÁ FEITOS nesta rodada, na ordem, incluindo o decisivo.
   *
   * Uma rodada de banca francesa não é um lançamento: é uma sequência deles, que só
   * acaba quando sai uma soma que decide. Guardar a sequência é o que deixa a tela
   * mostrar cada lance acontecendo em vez de escrever "relançou 3 vezes" no fim.
   */
  lancamentos: Lancamento[];
  /**
   * O relógio que dispara o próximo lance quando a janela de aposta acaba.
   *
   * Fica na mesa e não num mapa à parte porque tem exatamente o mesmo tempo de vida
   * que ela: mesa que fecha leva o relógio junto, e mesa esquecida com relógio pendente
   * seria uma mesa lançando dado pra ninguém. NÃO vai pra tela — `view()` monta o
   * estado campo a campo, então isto não vaza.
   */
  proximoLance?: ReturnType<typeof setTimeout>;
}

/**
 * Mesa compartilhada: ninguém joga contra o outro, todo mundo aposta contra o mesmo
 * resultado de dado, igual banca francesa (ou roleta) de cassino físico — por isso
 * não precisa esconder informação entre jogadores, diferente de truco/dominó/poker.
 * Até 15 lugares (uma cor de ficha por pessoa, ver player-colors.ts).
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'banca-francesa';

@Injectable()
export class BancaFrancesaTableService {
  private readonly tables = new Map<string, BancaFrancesaTable>();
  private nextId = 1;

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly usersService: UsersService,
    private readonly eventos: RegistroDeEventos,
  ) {}

  /**
   * Quem avisar quando a MESA se mexer sozinha.
   *
   * Até agora toda mudança de estado vinha de alguém: apostou, girou, saiu — e quem
   * respondia ao pedido também mandava o estado novo pra mesa. Com a janela entre
   * lançamentos existe uma mudança que ninguém pediu: o prazo acaba e a mesa lança. Sem
   * este aviso, os dados sairiam no servidor e as telas continuariam mostrando a janela
   * aberta até alguém tocar em alguma coisa.
   *
   * É um retorno de chamada, e não o gateway injetado aqui, pra a mesa continuar sem
   * saber que socket existe: ela avisa "mudei", e quem sabe transmitir transmite.
   */
  private ouvinte: ((table: BancaFrancesaTable) => void) | null = null;

  aoAtualizar(fn: (table: BancaFrancesaTable) => void) {
    this.ouvinte = fn;
  }

  private avisar(table: BancaFrancesaTable) {
    this.ouvinte?.(table);
  }

  /** Tira a mesa do ar de vez. Desarmar o relógio é o que impede um lance órfão. */
  private fecharMesa(table: BancaFrancesaTable) {
    this.cancelarProximoLance(table);
    this.tables.delete(table.id);
  }

  async createTable(hostUserId: string, visibility: TableVisibility): Promise<BancaFrancesaTable> {
    const host = (await this.requireUser(hostUserId));
    const table: BancaFrancesaTable = {
      id: `mesa-${this.nextId}`,
      code: generateTableCode(),
      visibility,
      hostUserId,
      seats: [],
      relogio: new RelogioDaSala(),
      rodadaId: '',
      rodadasJogadas: 0,
      lancamentos: [],
    };
    this.nextId += 1;
    table.seats.push({ userId: hostUserId, name: host.name, isBot: false, color: this.nextFreeColor(table), pendingBets: [] });
    this.tables.set(table.id, table);
    this.abrirRodada(table);
    return table;
  }

  async listPublicTables() {
    return Promise.all(
      [...this.tables.values()]
      .filter((table) => table.visibility === 'publica' && table.seats.length < MAX_SEATS)
      .map(async (table) => ({
        id: table.id,
        hostName: (await this.usersService.findById(table.hostUserId))?.name ?? table.hostUserId,
        seatedCount: table.seats.length,
        maxSeats: MAX_SEATS,
      })),
    );
  }

  async joinByCode(userId: string, code: string): Promise<BancaFrancesaTable> {
    const normalized = code.trim().toUpperCase();
    const table = [...this.tables.values()].find((item) => item.code === normalized);
    if (!table) throw new NotFoundException('Mesa não encontrada — confira o código.');
    return await this.seatPlayer(table, userId);
  }

  async joinById(userId: string, tableId: string): Promise<BancaFrancesaTable> {
    return await this.seatPlayer(this.requireTable(tableId), userId);
  }

  addBot(hostUserId: string, tableId: string): BancaFrancesaTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);
    if (table.seats.length >= MAX_SEATS) {
      throw new BadRequestException('Mesa cheia.');
    }
    const botNumber = table.seats.filter((seat) => seat.isBot).length + 1;
    table.seats.push({
      userId: `bot-${table.id}-${botNumber}`,
      name: `Bot ${botNumber}`,
      isBot: true,
      color: this.nextFreeColor(table),
      pendingBets: [],
    });
    return table;
  }

  /** Se o anfitrião sair, o próximo assento humano vira anfitrião; se não sobrar ninguém, a mesa acaba. */
  leaveTable(userId: string, tableId: string): BancaFrancesaTable | { removed: true } {
    const table = this.requireTable(tableId);
    table.seats = table.seats.filter((seat) => seat.userId !== userId);

    if (table.seats.length === 0) {
      this.fecharMesa(table);
      return { removed: true };
    }
    if (table.hostUserId === userId) {
      const nextHost = table.seats.find((seat) => !seat.isBot);
      if (!nextHost) {
        this.fecharMesa(table);
        return { removed: true };
      }
      table.hostUserId = nextHost.userId;
    }
    return table;
  }

  async placeBets(userId: string, tableId: string, bets: BancaFrancesaBet[]): Promise<BancaFrancesaTable> {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    /*
     * Antes daqui não existia fase, e uma aposta que chegasse no meio da apuração
     * entrava no `pendingBets` caladamente — pra ser cobrada na rodada seguinte, que a
     * pessoa não pediu.
     */
    if (!aceitaAposta(table.relogio.fase)) {
      throw new BadRequestException('As apostas desta rodada já fecharam.');
    }

    // O saldo é lido ANTES de validar, porque é ele que decide o nível e, com o nível,
    // os limites desta pessoa. Cada um na mesa tem o limite do próprio bolso.
    const saldo = await this.walletService.balanceOf(userId);
    this.validateBets(bets, saldo);

    /*
     * Guarda em QUE ESTADO a mesa estava, porque a linha seguinte cede o controle (é
     * `await`) e a mesa pode lançar nesse intervalo. Reconferir a fase quando a
     * execução voltasse não pegaria nada: o estado seguinte também é APOSTAS_ABERTAS.
     *
     * A marca é a VERSÃO do relógio, que sobe a cada mudança de fase, e não o id da
     * rodada. O id não serve mais desde que o lançamento nulo existe: numa rodada com
     * três nulos, o id é o mesmo do começo ao fim, então uma aposta que saísse antes de
     * um lance e chegasse depois passaria pela conferência — e entraria como aposta do
     * lance seguinte, que a pessoa não viu. A versão denuncia qualquer lance no meio.
     */
    const versaoPretendida = table.relogio.versao;

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    if (saldo < totalStake) {
      throw new BadRequestException('Saldo de fichas insuficiente pra essa aposta.');
    }

    if (table.relogio.versao !== versaoPretendida) {
      throw new BadRequestException('Os dados saíram enquanto a aposta ia — aposte de novo.');
    }

    seat.pendingBets = bets;
    return table;
  }

  /**
   * Manda lançar. Só o anfitrião — evita duas pessoas lançando ao mesmo tempo por engano.
   *
   * Isto lança UMA vez, não a rodada inteira. Se a soma decidir, a rodada é apurada e
   * paga; se não decidir, as apostas ficam em pé e abre uma janela pra mexer nelas —
   * ver `lancarNaMesa`. Durante a janela o anfitrião pode chamar de novo pra lançar
   * antes do prazo, e é por isso que a fase aceita aposta nos dois momentos.
   */
  async roll(hostUserId: string, tableId: string): Promise<BancaFrancesaTable> {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);

    if (!aceitaAposta(table.relogio.fase)) {
      throw new BadRequestException('Os dados já estão rolando.');
    }

    /*
     * NÃO SE LANÇA DADO NUMA MESA SEM APOSTA. Antes dava, e o resultado era uma rodada
     * inteira acontecendo — dados rolando, resultado apurado, placar registrado — sem
     * uma ficha em jogo. Além de não fazer sentido, sujava o placar com resultados que
     * ninguém apostou, e o placar é justamente o que as pessoas usam pra decidir.
     *
     * O primeiro lançamento exige aposta. Do segundo em diante (depois de um nulo) não
     * exige: quem retirou as fichas na janela saiu da rodada, e a rodada continua pra
     * quem ficou — inclusive quando sobrou ninguém, porque o resultado ainda precisa
     * sair pra a rodada fechar.
     */
    const primeiroLance = table.lancamentos.length === 0;
    const alguemApostou = table.seats.some((seat) => seat.pendingBets.length > 0 || seat.isBot);
    if (primeiroLance && !alguemApostou) {
      throw new BadRequestException('Ninguém apostou ainda — encoste uma ficha no pano antes de lançar.');
    }

    return await this.lancarNaMesa(table);
  }

  /**
   * Tira as fichas da mesa e sai da rodada.
   *
   * NÃO CUSTA NADA, e isso é regra, não gentileza: nesta mesa a ficha só sai do saldo
   * quando um lançamento decide (ver a apuração em `apurar`). Antes disso a aposta é
   * uma intenção guardada em `pendingBets` — quem desiste no meio de uma sequência de
   * nulos sai com o mesmo saldo com que entrou, sem lançamento nenhum no extrato.
   *
   * A janela é a mesma da aposta, de propósito: dá pra retirar enquanto dá pra apostar,
   * e nem um instante depois. Retirar depois de ver o dado seria escolher o resultado.
   */
  retirarApostas(userId: string, tableId: string): BancaFrancesaTable {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (!aceitaAposta(table.relogio.fase)) {
      throw new BadRequestException('Tarde demais — os dados já estão rolando.');
    }
    if (seat.pendingBets.length === 0) {
      return table;
    }

    seat.pendingBets = [];
    this.anotar(table, 'APOSTA_RETIRADA', { userId });
    return table;
  }

  /**
   * UM lançamento dos três dados, e o que fazer com o que saiu.
   *
   * Das 216 combinações, 63 decidem (1 de Ases, 31 de Pequeno, 31 de Grande). As
   * outras — 4, 8 a 13, 17, 18 — são NULAS: não resolvem aposta nenhuma e os dados
   * voltam pro copo. Isso é regra do jogo e é o que calibra o RTP.
   *
   * Antes, a rodada inteira acontecia dentro de uma chamada: a mesa lançava até decidir
   * e a tela recebia a sequência pronta pra animar. Funcionava, mas transformava o nulo
   * em enfeite — os dados "voltavam pro copo" numa animação enquanto o resultado já
   * estava decidido, e ninguém podia fazer nada entre um lance e outro. Na mesa de
   * verdade é justamente aí que se aumenta a aposta ou se desiste dela.
   *
   * Agora cada lance é um evento. Nulo reabre as apostas com prazo, e o prazo é do
   * SERVIDOR: o app recebe o instante em que acaba e anima o relógio sozinho. Chegar a
   * zero no celular não lança nada — quem lança é o relógio daqui.
   */
  private async lancarNaMesa(table: BancaFrancesaTable): Promise<BancaFrancesaTable> {
    // Se o anfitrião lançou antes do prazo, o relógio da janela não pode disparar depois.
    this.cancelarProximoLance(table);

    const primeiroDaRodada = table.lancamentos.length === 0;

    /*
     * Fechar as apostas é a PRIMEIRA coisa: a partir desta linha, aposta que chegar é
     * recusada, inclusive a que estiver na rede a caminho. Vale igual pro primeiro
     * lance e pro que vem depois de um nulo.
     */
    table.relogio.irPara('APOSTAS_FECHADAS');
    this.anotar(table, 'APOSTAS_FECHADAS', {});

    /*
     * Bot aposta uma vez por rodada, no primeiro lance. Deixar o bot remexer a aposta a
     * cada nulo daria a ele uma decisão que o jogador humano nem sempre está olhando
     * pra tomar — e não muda nada no resultado, porque cada lançamento é independente.
     */
    if (primeiroDaRodada) {
      for (const seat of table.seats) {
        if (seat.isBot && seat.pendingBets.length === 0) {
          const type = umDe(BET_TYPES);
          seat.pendingBets = [{ type, amount: NIVEIS_DE_MESA[0].minimo }];
        }
      }
    }

    table.relogio.irPara('SORTEIO');
    let lance = lancar();
    table.lancamentos.push(lance);
    this.anotarLance(table, lance);

    if (!lance.outcome) {
      if (table.lancamentos.length < LANCAMENTOS_MAXIMOS_COM_JANELA) {
        return this.reabrirApostas(table);
      }
      /*
       * Teto batido: daqui em diante lança até decidir, sem mais janelas. Não é regra
       * de jogo — é o jeito de a rodada TERMINAR em vez de a mesa ficar abrindo janela
       * pra sempre. Ninguém fica com aposta presa, e a chance de chegar aqui é
       * (153/216)^40, cerca de 1 em 10 milhões de bilhões.
       */
      while (!lance.outcome) {
        lance = lancar();
        table.lancamentos.push(lance);
        this.anotarLance(table, lance);
      }
    }

    return await this.apurar(table, lance.outcome);
  }

  /**
   * O lançamento não decidiu: as apostas voltam a aceitar mexida, com prazo.
   *
   * A mesma rodada continua — o `rodadaId` não muda e ninguém foi cobrado ainda. Por
   * isso a volta é uma transição de fase (SORTEIO -> APOSTAS_ABERTAS) e não um fechar
   * e abrir de novo: fechar aqui geraria extrato de uma aposta que nunca foi resolvida.
   */
  private reabrirApostas(table: BancaFrancesaTable): BancaFrancesaTable {
    table.relogio.irPara('APOSTAS_ABERTAS', JANELA_ENTRE_LANCAMENTOS_MS);
    this.anotar(table, 'APOSTAS_ABERTAS', {
      rodadaId: table.rodadaId,
      motivo: 'LANCAMENTO_NULO',
      lancamentosFeitos: table.lancamentos.length,
      terminaEm: table.relogio.terminaEm,
    });

    table.proximoLance = setTimeout(() => void this.lancarPeloRelogio(table.id), JANELA_ENTRE_LANCAMENTOS_MS);
    return table;
  }

  /**
   * O prazo da janela acabou: lança sozinho e avisa a mesa.
   *
   * Recebe o ID e não a mesa porque durante os 12 segundos ela pode ter fechado (todo
   * mundo saiu) — buscar de novo é o que diferencia "a mesa acabou" de lançar dado numa
   * mesa que não existe mais.
   */
  private async lancarPeloRelogio(tableId: string): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) return;
    // O anfitrião lançou antes do prazo: este relógio ficou pra trás.
    if (!aceitaAposta(table.relogio.fase)) return;

    try {
      await this.lancarNaMesa(table);
    } catch (erro) {
      console.error(`[banca-francesa] o lance automático da mesa ${tableId} falhou:`, erro);
      return;
    }
    this.avisar(table);
  }

  /**
   * Saiu um resultado: resolve cada assento, paga e encerra a rodada.
   *
   * Cada assento é resolvido isoladamente: se alguém gastou as fichas em outra mesa
   * entre apostar aqui e o dado decidir (dá pra estar em duas telas de jogo — não
   * existe trava de "uma mesa por vez" pro saldo), a aposta dessa pessoa é anulada em
   * vez de travar a rodada de todo mundo.
   *
   * É AQUI que a ficha sai do saldo, e não quando a aposta é posta na mesa. Essa
   * escolha é o que faz retirar no meio de uma sequência de nulos não custar nada.
   */
  private async apurar(table: BancaFrancesaTable, outcome: DecisiveOutcome): Promise<BancaFrancesaTable> {
    table.relogio.irPara('APURACAO');
    const bySeat: RoundResult['bySeat'] = {};

    for (const seat of table.seats) {
      if (seat.pendingBets.length === 0) continue;

      const totalStake = seat.pendingBets.reduce((sum, bet) => sum + bet.amount, 0);

      if (!seat.isBot && await this.walletService.balanceOf(seat.userId) < totalStake) {
        seat.pendingBets = [];
        continue;
      }

      const results = resolveBets(outcome, seat.pendingBets);
      const totalReturn = results.reduce((sum, result) => sum + result.totalReturn, 0);

      if (!seat.isBot) {
        /*
         * A chave de idempotência é (mesa, rodada, jogador): a mesma rodada não cobra a
         * mesma pessoa duas vezes nem que este método seja chamado de novo. A rodada
         * inteira é uma cobrança só, por mais lançamentos que ela tenha levado.
         */
        const acao = `${table.id}:${table.rodadaId}:${seat.userId}`;
        await this.walletService.debit(seat.userId, totalStake, 'aposta', GAME_ID, `${acao}:aposta`);
        if (totalReturn > 0) {
          await this.walletService.credit(seat.userId, totalReturn, 'premio', GAME_ID, `${acao}:premio`);
        }
        await this.tournaments.recordRound(seat.userId, GAME_ID, totalStake, totalReturn);
      }

      bySeat[seat.userId] = { results, totalStake, totalReturn };
      seat.pendingBets = [];
    }

    table.relogio.irPara('PAGAMENTO');

    // O último da lista é o que decidiu; todos os anteriores foram nulos, por definição.
    const decisivo = table.lancamentos[table.lancamentos.length - 1];
    const nulos = table.lancamentos.slice(0, -1).map((item) => item.dice);
    table.lastRound = {
      dice: decisivo.dice,
      sum: decisivo.sum,
      outcome,
      rerolls: nulos.length,
      lancamentosNulos: nulos,
      bySeat,
      at: new Date().toISOString(),
    };
    // O log guarda só o que é público: quem apostou o quê e quanto levou já é visível
    // nesta mesa (todo mundo aposta no mesmo resultado), então nada aqui é privado.
    this.anotar(table, 'PAGAMENTO', { bySeat });

    table.relogio.irPara('RODADA_FECHADA');
    this.anotar(table, 'RODADA_FECHADA', {});

    // A próxima já abre: a mesa fica pronta pra apostar de novo sem ninguém pedir.
    this.abrirRodada(table);
    return table;
  }

  private anotarLance(table: BancaFrancesaTable, lance: Lancamento) {
    this.anotar(table, lance.outcome ? 'DADOS' : 'DADOS_NULOS', {
      dice: lance.dice,
      sum: lance.sum,
      outcome: lance.outcome,
      lance: table.lancamentos.length,
    });
  }

  /** Desarma o relógio da janela, se houver um armado. Chamar antes de qualquer lance. */
  private cancelarProximoLance(table: BancaFrancesaTable) {
    if (table.proximoLance) {
      clearTimeout(table.proximoLance);
      table.proximoLance = undefined;
    }
  }

  /**
   * Começa uma rodada nova: id próprio, apostas abertas, evento anotado.
   *
   * O id da rodada é o que amarra o log de eventos, o extrato e a chave de idempotência
   * — sem ele, "a aposta da rodada passada" e "a desta" seriam indistinguíveis.
   */
  private abrirRodada(table: BancaFrancesaTable) {
    /*
     * A sequência de lançamentos é POR RODADA. Sem zerar aqui, a segunda rodada nasceria
     * já contando os nulos da primeira contra o teto, e `lastRound` mostraria dados de
     * uma rodada que já foi paga.
     */
    this.cancelarProximoLance(table);
    table.lancamentos = [];
    table.rodadasJogadas += 1;
    table.rodadaId = `${table.id}-r${table.rodadasJogadas}`;
    if (table.relogio.fase !== 'RODADA_ABERTA') table.relogio.irPara('RODADA_ABERTA');
    table.relogio.irPara('APOSTAS_ABERTAS');
    this.anotar(table, 'APOSTAS_ABERTAS', { rodadaId: table.rodadaId });
  }

  private anotar(table: BancaFrancesaTable, tipo: string, dados: unknown) {
    return this.eventos.anotar(table.id, table.rodadaId, tipo, dados);
  }

  /** Em que mesas esta pessoa está sentada. Usado na queda, pra guardar os assentos. */
  mesasDoJogador(userId: string): string[] {
    return [...this.tables.values()]
      .filter((mesa) => mesa.seats.some((assento) => assento.userId === userId))
      .map((mesa) => mesa.id);
  }

  /** A mesa, ou undefined. Diferente de `requireTable`, não lança — quem volta de uma
   *  queda pode estar voltando pra uma mesa que já fechou, e isso não é erro. */
  buscarMesa(tableId: string): BancaFrancesaTable | undefined {
    return this.tables.get(tableId);
  }

  /**
   * A rodada que está acontecendo AGORA — os lançamentos já feitos e o que falta.
   *
   * Diferente de `lastRound`, que é a rodada que acabou. Isto é o que deixa a tela
   * mostrar o nulo enquanto ele importa: os dados que saíram, quantos lances já foram e
   * se a mesa está esperando gente decidir. Sem isto, quem entrasse no meio de uma
   * sequência de nulos veria uma mesa parada sem entender por quê.
   */
  rodadaEmAndamento(table: BancaFrancesaTable) {
    return {
      rodadaId: table.rodadaId,
      lancamentos: table.lancamentos,
      /** Verdadeiro quando as apostas reabriram porque o dado não decidiu. */
      esperandoDepoisDeNulo: table.lancamentos.length > 0 && aceitaAposta(table.relogio.fase),
    };
  }

  /** A fase e a versão, pra tela saber o que pode fazer e o que já está velho. */
  faseDaMesa(table: BancaFrancesaTable) {
    return {
      rodadaId: table.rodadaId,
      ...table.relogio.paraEvento(),
      seq: this.eventos.seqAtual(table.id),
    };
  }

  async balanceOf(userId: string): Promise<number> {
    return await this.walletService.balanceOf(userId);
  }

  /** Assento de alguém numa mesa, se existir — usado pelo chat pra pegar a cor da ficha. */
  findSeat(tableId: string, userId: string): TableSeat | undefined {
    return this.tables.get(tableId)?.seats.find((seat) => seat.userId === userId);
  }

  private async seatPlayer(table: BancaFrancesaTable, userId: string): Promise<BancaFrancesaTable> {
    if (table.seats.some((seat) => seat.userId === userId)) {
      return table;
    }
    if (table.seats.length >= MAX_SEATS) {
      throw new BadRequestException('Mesa cheia.');
    }
    const user = (await this.requireUser(userId));
    table.seats.push({ userId, name: user.name, isBot: false, color: this.nextFreeColor(table), pendingBets: [] });
    return table;
  }

  private nextFreeColor(table: BancaFrancesaTable): PlayerColor {
    const taken = new Set(table.seats.map((seat) => seat.color));
    const free = PLAYER_COLORS.find((color) => !taken.has(color));
    if (!free) {
      throw new BadRequestException('Mesa cheia.');
    }
    return free;
  }

  /**
   * Confere as apostas contra o NÍVEL DE MESA de quem está apostando.
   *
   * Antes eram dois números fixos no código — mínimo 50, máximo 5.000 — iguais pra
   * quem acabou de criar a conta e pra quem tem cem milhões. Quem tinha cem milhões
   * apostava no máximo cinco mil: 0,005% da banca, uma aposta que não mexe em nada.
   *
   * Agora o limite sai do saldo, pela escada de níveis (`niveis-de-mesa.ts`), onde o
   * mínimo é 1% do saldo de entrada do nível e o máximo é 20%. A aposta pesa o mesmo
   * pra quem tem cinquenta mil e pra quem tem cinco milhões.
   *
   * A conferência é aqui, no servidor, e não só na tela: o trilho de fichas que o
   * aplicativo mostra é conveniência, e conveniência não é tranca.
   */
  private validateBets(bets: BancaFrancesaBet[], saldo: number) {
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > MAX_SIMULTANEOUS_BETS) {
      throw new BadRequestException(`Aposte em 1 a ${MAX_SIMULTANEOUS_BETS} tipos (ases, pequeno, grande, linha).`);
    }

    const nivel = nivelPara(saldo);
    const seen = new Set<string>();
    for (const bet of bets) {
      if (!BET_TYPES.includes(bet.type)) {
        throw new BadRequestException(`Tipo de aposta inválido: ${bet.type}.`);
      }
      if (seen.has(bet.type)) {
        throw new BadRequestException(`Aposta em "${bet.type}" duplicada — some tudo numa aposta só.`);
      }
      seen.add(bet.type);
      /*
       * A REGRA DE VALOR VEM DE UM LUGAR SÓ (`problemaComAAposta`), e não de uma cópia
       * escrita aqui.
       *
       * Havia duas cópias — esta e a da mesa compartilhada — e as duas continuaram
       * recusando aposta acima de vinte vezes o mínimo depois que o teto foi tirado do
       * jogo. Quem tinha cem bilhões montava cinquenta bilhões no pano e a mesa
       * respondia "cada aposta vai de 500.000.000 a 10.000.000.000": um limite que não
       * existia mais em lugar nenhum, menos aqui. É exatamente o defeito que a função
       * compartilhada foi criada pra impedir, e ela só impede se for a única a decidir.
       */
      const problema = problemaComAAposta(bet.amount, saldo);
      if (problema) throw new BadRequestException(problema);
    }
  }

  private requireTable(tableId: string): BancaFrancesaTable {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new NotFoundException('Mesa não encontrada.');
    }
    return table;
  }

  private requireSeat(table: BancaFrancesaTable, userId: string): TableSeat {
    const seat = table.seats.find((item) => item.userId === userId);
    if (!seat) {
      throw new ForbiddenException('Você não está sentado nessa mesa.');
    }
    return seat;
  }

  private requireHost(table: BancaFrancesaTable, userId: string) {
    if (table.hostUserId !== userId) {
      throw new ForbiddenException('Só quem criou a mesa pode fazer isso.');
    }
  }

  private async requireUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }
}
