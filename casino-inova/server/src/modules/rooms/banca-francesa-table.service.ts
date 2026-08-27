import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';
import { BancaFrancesaBet, BetResult, resolveBets, rollUntilDecisive } from '../games/banca-francesa/banca-francesa.engine';
import { BET_TYPES, MAX_BET, MAX_SIMULTANEOUS_BETS, MIN_BET } from '../games/banca-francesa/banca-francesa.config';
import { MAX_SEATS, PLAYER_COLORS, PlayerColor } from './player-colors';
import { generateTableCode } from './table-code';

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
  ) {}

  createTable(hostUserId: string, visibility: TableVisibility): BancaFrancesaTable {
    const host = this.requireUser(hostUserId);
    const table: BancaFrancesaTable = {
      id: `mesa-${this.nextId}`,
      code: generateTableCode(),
      visibility,
      hostUserId,
      seats: [],
    };
    this.nextId += 1;
    table.seats.push({ userId: hostUserId, name: host.name, isBot: false, color: this.nextFreeColor(table), pendingBets: [] });
    this.tables.set(table.id, table);
    return table;
  }

  listPublicTables() {
    return [...this.tables.values()]
      .filter((table) => table.visibility === 'publica' && table.seats.length < MAX_SEATS)
      .map((table) => ({
        id: table.id,
        hostName: this.usersService.findById(table.hostUserId)?.name ?? table.hostUserId,
        seatedCount: table.seats.length,
        maxSeats: MAX_SEATS,
      }));
  }

  joinByCode(userId: string, code: string): BancaFrancesaTable {
    const normalized = code.trim().toUpperCase();
    const table = [...this.tables.values()].find((item) => item.code === normalized);
    if (!table) throw new NotFoundException('Mesa não encontrada — confira o código.');
    return this.seatPlayer(table, userId);
  }

  joinById(userId: string, tableId: string): BancaFrancesaTable {
    return this.seatPlayer(this.requireTable(tableId), userId);
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

  placeBets(userId: string, tableId: string, bets: BancaFrancesaBet[]): BancaFrancesaTable {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);
    this.validateBets(bets);

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    if (this.walletService.balanceOf(userId) < totalStake) {
      throw new BadRequestException('Saldo de fichas insuficiente pra essa aposta.');
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
  roll(hostUserId: string, tableId: string): BancaFrancesaTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);

    for (const seat of table.seats) {
      if (seat.isBot && seat.pendingBets.length === 0) {
        const type = BET_TYPES[Math.floor(Math.random() * BET_TYPES.length)];
        seat.pendingBets = [{ type, amount: MIN_BET }];
      }
    }

    const { dice, sum, outcome } = rollUntilDecisive();
    const bySeat: RoundResult['bySeat'] = {};

    for (const seat of table.seats) {
      if (seat.pendingBets.length === 0) continue;

      const totalStake = seat.pendingBets.reduce((sum, bet) => sum + bet.amount, 0);

      if (!seat.isBot && this.walletService.balanceOf(seat.userId) < totalStake) {
        seat.pendingBets = [];
        continue;
      }

      const results = resolveBets(outcome, seat.pendingBets);
      const totalReturn = results.reduce((sum, result) => sum + result.totalReturn, 0);

      if (!seat.isBot) {
        this.walletService.debit(seat.userId, totalStake, 'aposta', GAME_ID);
        if (totalReturn > 0) {
          this.walletService.credit(seat.userId, totalReturn, 'premio', GAME_ID);
        }
        this.tournaments.recordRound(seat.userId, GAME_ID, totalStake, totalReturn);
      }

      bySeat[seat.userId] = { results, totalStake, totalReturn };
      seat.pendingBets = [];
    }

    table.lastRound = { dice, sum, outcome, bySeat, at: new Date().toISOString() };
    return table;
  }

  balanceOf(userId: string): number {
    return this.walletService.balanceOf(userId);
  }

  /** Assento de alguém numa mesa, se existir — usado pelo chat pra pegar a cor da ficha. */
  findSeat(tableId: string, userId: string): TableSeat | undefined {
    return this.tables.get(tableId)?.seats.find((seat) => seat.userId === userId);
  }

  private seatPlayer(table: BancaFrancesaTable, userId: string): BancaFrancesaTable {
    if (table.seats.some((seat) => seat.userId === userId)) {
      return table;
    }
    if (table.seats.length >= MAX_SEATS) {
      throw new BadRequestException('Mesa cheia.');
    }
    const user = this.requireUser(userId);
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

  private requireUser(userId: string) {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }
}
