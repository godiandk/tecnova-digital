import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';
import { BancaFrancesaBet, BetResult, resolveBets, rollUntilDecisive } from '../games/banca-francesa/banca-francesa.engine';
import { BET_TYPES, MAX_BET, MAX_SIMULTANEOUS_BETS, MIN_BET } from '../games/banca-francesa/banca-francesa.config';
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
      this.tables.delete(table.id);
      return { removed: true };
    }
    if (table.hostUserId === userId) {
      const nextHost = table.seats.find((seat) => !seat.isBot);
      if (!nextHost) {
        this.tables.delete(table.id);
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
    this.validateBets(bets);

    /*
     * Guarda em QUAL rodada esta aposta está entrando, porque a linha seguinte cede o
     * controle (é `await`) e o anfitrião pode girar nesse intervalo. Conferir a fase só
     * aqui em cima não bastava: quando a execução voltasse, a rodada podia já ser outra
     * — e como a rodada nova também está em APOSTAS_ABERTAS, reconferir a fase não
     * pegaria nada. Quem denuncia é o id da rodada, não a fase.
     */
    const rodadaPretendida = table.rodadaId;

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    if (await this.walletService.balanceOf(userId) < totalStake) {
      throw new BadRequestException('Saldo de fichas insuficiente pra essa aposta.');
    }

    if (table.rodadaId !== rodadaPretendida) {
      throw new BadRequestException('A rodada virou enquanto a aposta ia — aposte de novo.');
    }

    seat.pendingBets = bets;
    return table;
  }

  /**
   * Só o anfitrião gira — evita duas pessoas girando ao mesmo tempo por engano.
   * Cada assento é resolvido isoladamente: se alguém gastou as fichas em outra mesa
   * entre apostar aqui e o anfitrião girar (dá pra estar em duas telas de jogo — não
   * existe trava de "uma mesa por vez" pro saldo), a aposta dessa pessoa é anulada em
   * vez de travar a rodada de todo mundo.
   */
  async roll(hostUserId: string, tableId: string): Promise<BancaFrancesaTable> {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);

    if (!aceitaAposta(table.relogio.fase)) {
      throw new BadRequestException('Esta rodada já foi girada.');
    }

    /*
     * Daqui pra baixo a rodada anda pelas fases na ordem, e cada uma é anotada no log.
     * Fechar as apostas é a PRIMEIRA coisa: a partir desta linha, aposta que chegar é
     * recusada, inclusive a que estiver na rede a caminho.
     */
    table.relogio.irPara('APOSTAS_FECHADAS');
    this.anotar(table, 'APOSTAS_FECHADAS', {});

    for (const seat of table.seats) {
      if (seat.isBot && seat.pendingBets.length === 0) {
        const type = umDe(BET_TYPES);
        seat.pendingBets = [{ type, amount: MIN_BET }];
      }
    }

    table.relogio.irPara('SORTEIO');
    const { dice, sum, outcome } = rollUntilDecisive();
    this.anotar(table, 'DADOS', { dice, sum, outcome });

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
         * mesma pessoa duas vezes nem que este método seja chamado de novo.
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
    table.lastRound = { dice, sum, outcome, bySeat, at: new Date().toISOString() };
    // O log guarda só o que é público: quem apostou o quê e quanto levou já é visível
    // nesta mesa (todo mundo aposta no mesmo resultado), então nada aqui é privado.
    this.anotar(table, 'PAGAMENTO', { bySeat });

    table.relogio.irPara('RODADA_FECHADA');
    this.anotar(table, 'RODADA_FECHADA', {});

    // A próxima já abre: a mesa fica pronta pra apostar de novo sem ninguém pedir.
    this.abrirRodada(table);
    return table;
  }

  /**
   * Começa uma rodada nova: id próprio, apostas abertas, evento anotado.
   *
   * O id da rodada é o que amarra o log de eventos, o extrato e a chave de idempotência
   * — sem ele, "a aposta da rodada passada" e "a desta" seriam indistinguíveis.
   */
  private abrirRodada(table: BancaFrancesaTable) {
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

  private validateBets(bets: BancaFrancesaBet[]) {
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > MAX_SIMULTANEOUS_BETS) {
      throw new BadRequestException(`Aposte em 1 a ${MAX_SIMULTANEOUS_BETS} tipos (ases, pequeno, grande, linha).`);
    }
    const seen = new Set<string>();
    for (const bet of bets) {
      if (!BET_TYPES.includes(bet.type)) {
        throw new BadRequestException(`Tipo de aposta inválido: ${bet.type}.`);
      }
      if (seen.has(bet.type)) {
        throw new BadRequestException(`Aposta em "${bet.type}" duplicada — some tudo numa aposta só.`);
      }
      seen.add(bet.type);
      if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
        throw new BadRequestException(`Cada aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
      }
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
