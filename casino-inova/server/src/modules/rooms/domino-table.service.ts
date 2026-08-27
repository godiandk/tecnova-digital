import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { BoardEnd, canPlay, otherEnd, shuffle, tileMatches, tileSum } from '../games/domino/domino.engine';
import { buildTileSet, HAND_SIZE, MAX_BUY_IN, MIN_BUY_IN, Tile } from '../games/domino/domino.config';
import { generateTableCode } from './table-code';

/**
 * Mesa 2x2 de dominó online — mesma estrutura da mesa de truco: quatro pessoas, duas
 * duplas, e cada uma só enxerga as próprias peças.
 *
 * Com 4 jogadores o baralho fecha exato: 28 peças, 7 pra cada, sem monte de compra.
 * Quem não tem peça que encaixe passa a vez.
 *
 * Pontuação (regras conferidas em jogosdorei.com.br e na Wikipédia PT, agosto/2026):
 * - Batida simples (peça encaixa numa ponta só): 1 ponto
 * - Batida de carroça (a última peça é uma dupla): 2 pontos
 * - "Lá-e-lô" (peça simples que fecha nas DUAS pontas): 3 pontos
 * - Cruzada / quadrada (carroça que fecha nas duas pontas): 4 pontos
 * - Vence a dupla que chegar a 6 pontos primeiro
 *
 * Quando a mesa trava (ninguém consegue jogar), vence a dupla com menor soma de
 * pintas na mão, valendo 1 ponto. Empate na contagem: perde quem travou — as fontes
 * divergem um pouco aqui (uma fala em levar a soma do adversário), então ficamos com
 * a leitura mais simples e a deixamos documentada.
 */

export type TableVisibility = 'publica' | 'privada';
export type Team = 'A' | 'B';

export interface DominoSeat {
  seatIndex: number;
  userId: string;
  name: string;
  isBot: boolean;
  team: Team;
  hand: Tile[];
}

export interface DominoOnlineTable {
  id: string;
  code: string;
  visibility: TableVisibility;
  hostUserId: string;
  buyIn: number;
  seats: DominoSeat[];
  started: boolean;

  score: Record<Team, number>;
  board: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  turnSeat: number;
  /** Passes seguidos: chegando a 4, a mesa travou. */
  consecutivePasses: number;
  /** Quem bateu na mão anterior começa a próxima. */
  lastHandStarter: number;

  finished: boolean;
  winnerTeam?: Team;
  lastEvent?: string;
}

const SEATS = 4;
const POINTS_TO_WIN = 6;

function teamOfSeat(seatIndex: number): Team {
  return seatIndex % 2 === 0 ? 'A' : 'B';
}

function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'domino';

@Injectable()
export class DominoTableService {
  private readonly tables = new Map<string, DominoOnlineTable>();
  private nextId = 1;

  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  createTable(hostUserId: string, options: { visibility: TableVisibility; buyIn: number }): DominoOnlineTable {
    const { visibility, buyIn } = options;
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }

    const host = this.requireUser(hostUserId);
    const table: DominoOnlineTable = {
      id: `domino-${this.nextId}`,
      code: generateTableCode(),
      visibility,
      hostUserId,
      buyIn,
      seats: [{ seatIndex: 0, userId: hostUserId, name: host.name, isBot: false, team: 'A', hand: [] }],
      started: false,
      score: { A: 0, B: 0 },
      board: [],
      leftEnd: null,
      rightEnd: null,
      turnSeat: 0,
      consecutivePasses: 0,
      lastHandStarter: -1,
      finished: false,
    };
    this.nextId += 1;
    this.tables.set(table.id, table);
    return table;
  }

  listPublicTables() {
    return [...this.tables.values()]
      .filter((table) => table.visibility === 'publica' && !table.started && table.seats.length < SEATS)
      .map((table) => ({
        id: table.id,
        hostName: this.usersService.findById(table.hostUserId)?.name ?? table.hostUserId,
        seatedCount: table.seats.length,
        maxSeats: SEATS,
        buyIn: table.buyIn,
      }));
  }

  joinByCode(userId: string, code: string): DominoOnlineTable {
    const normalized = code.trim().toUpperCase();
    const table = [...this.tables.values()].find((item) => item.code === normalized);
    if (!table) throw new NotFoundException('Mesa não encontrada — confira o código.');
    return this.seatPlayer(table, userId);
  }

  joinById(userId: string, tableId: string): DominoOnlineTable {
    return this.seatPlayer(this.requireTable(tableId), userId);
  }

  addBot(hostUserId: string, tableId: string): DominoOnlineTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);
    if (table.started) throw new BadRequestException('A partida já começou.');
    const seatIndex = this.nextFreeSeat(table);
    const botNumber = table.seats.filter((seat) => seat.isBot).length + 1;
    table.seats.push({
      seatIndex,
      userId: `bot-${table.id}-${botNumber}`,
      name: `Bot ${botNumber}`,
      isBot: true,
      team: teamOfSeat(seatIndex),
      hand: [],
    });
    return table;
  }

  start(hostUserId: string, tableId: string): DominoOnlineTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);
    if (table.started) throw new BadRequestException('A partida já começou.');
    if (table.seats.length < SEATS) {
      throw new BadRequestException(`Faltam ${SEATS - table.seats.length} jogador(es).`);
    }

    for (const seat of table.seats) {
      if (!seat.isBot && this.walletService.balanceOf(seat.userId) < table.buyIn) {
        throw new BadRequestException(`${seat.name} não tem fichas suficientes pro buy-in.`);
      }
    }
    for (const seat of table.seats) {
      if (!seat.isBot) this.walletService.debit(seat.userId, table.buyIn, 'aposta', GAME_ID);
    }

    table.started = true;
    this.dealNewHand(table);
    return table;
  }

  playTile(userId: string, tableId: string, tile: Tile, end: BoardEnd): DominoOnlineTable {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (!table.started) throw new BadRequestException('A partida ainda não começou.');
    if (table.finished) throw new BadRequestException('A partida já acabou.');
    if (table.turnSeat !== seat.seatIndex) throw new BadRequestException('Não é a sua vez.');

    const index = seat.hand.findIndex((item) => item.a === tile.a && item.b === tile.b);
    if (index === -1) throw new BadRequestException('Essa peça não está na sua mão.');

    this.placeTile(table, seat, index, end);
    if (table.finished) return table;

    this.advanceTurn(table);
    this.autoPlayBots(table);
    return table;
  }

  pass(userId: string, tableId: string): DominoOnlineTable {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (table.turnSeat !== seat.seatIndex) throw new BadRequestException('Não é a sua vez.');
    if (canPlay(seat.hand, table.leftEnd, table.rightEnd)) {
      throw new BadRequestException('Você tem peça que encaixa — não pode passar.');
    }

    table.consecutivePasses += 1;
    table.lastEvent = `${seat.name} passou a vez.`;

    // Quatro passes seguidos = ninguém consegue jogar = mesa travada.
    if (table.consecutivePasses >= SEATS) {
      this.resolveBlockedHand(table);
      return table;
    }

    this.advanceTurn(table);
    this.autoPlayBots(table);
    return table;
  }

  leaveTable(userId: string, tableId: string): DominoOnlineTable | { removed: true } {
    const table = this.requireTable(tableId);
    table.seats = table.seats.filter((seat) => seat.userId !== userId);

    if (table.started || table.seats.filter((seat) => !seat.isBot).length === 0) {
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

  partnerUserIdOf(tableId: string, userId: string): string | undefined {
    const table = this.tables.get(tableId);
    const seat = table?.seats.find((item) => item.userId === userId);
    if (!table || !seat) return undefined;
    return table.seats.find((item) => item.seatIndex === (seat.seatIndex + 2) % SEATS)?.userId;
  }

  /** Cada um só recebe a própria mão; dos outros vai só a contagem de peças. */
  viewFor(table: DominoOnlineTable, userId: string) {
    const mySeat = table.seats.find((seat) => seat.userId === userId);
    return {
      id: table.id,
      code: table.code,
      visibility: table.visibility,
      hostUserId: table.hostUserId,
      buyIn: table.buyIn,
      started: table.started,
      finished: table.finished,
      winnerTeam: table.winnerTeam,
      score: table.score,
      board: table.board,
      leftEnd: table.leftEnd,
      rightEnd: table.rightEnd,
      turnSeat: table.turnSeat,
      lastEvent: table.lastEvent,
      pointsToWin: POINTS_TO_WIN,
      /** Se você pode jogar agora — evita a tela ter que recalcular a regra. */
      canPlayNow: mySeat ? canPlay(mySeat.hand, table.leftEnd, table.rightEnd) : false,
      seats: table.seats.map((seat) => ({
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        name: seat.name,
        isBot: seat.isBot,
        team: seat.team,
        tilesInHand: seat.hand.length,
        hand: seat.userId === userId ? seat.hand : undefined,
        isYou: seat.userId === userId,
        isPartner: table.seats.find((item) => item.seatIndex === (seat.seatIndex + 2) % SEATS)?.userId === userId,
      })),
    };
  }

  getTable(tableId: string): DominoOnlineTable | undefined {
    return this.tables.get(tableId);
  }

  // ---------- interno ----------

  /**
   * Coloca a peça e, se foi a última da mão, pontua a batida. O valor depende de COMO
   * a peça fechou: nas duas pontas vale mais, e sendo carroça vale mais ainda.
   */
  private placeTile(table: DominoOnlineTable, seat: DominoSeat, handIndex: number, end: BoardEnd) {
    const [tile] = seat.hand.splice(handIndex, 1);

    if (table.board.length === 0) {
      table.board.push(tile);
      table.leftEnd = tile.a;
      table.rightEnd = tile.b;
    } else {
      const target = end === 'esquerda' ? table.leftEnd! : table.rightEnd!;
      if (!tileMatches(tile, target)) {
        // Devolve a peça: a jogada não vale.
        seat.hand.splice(handIndex, 0, tile);
        throw new BadRequestException('Essa peça não encaixa nessa ponta.');
      }
      const newEnd = otherEnd(tile, target);
      if (end === 'esquerda') {
        table.board.unshift(tile);
        table.leftEnd = newEnd;
      } else {
        table.board.push(tile);
        table.rightEnd = newEnd;
      }
    }

    table.consecutivePasses = 0;
    table.lastEvent = `${seat.name} jogou ${tile.a}-${tile.b}.`;

    if (seat.hand.length === 0) {
      // Fechou nas duas pontas? Só dá pra saber comparando com o estado ANTES da
      // jogada — por isso a checagem usa a peça e as pontas resultantes.
      const closedBothEnds = table.board.length > 1 && table.leftEnd === table.rightEnd;
      const points = isDouble(tile)
        ? closedBothEnds
          ? 4 // cruzada
          : 2 // carroça
        : closedBothEnds
          ? 3 // lá-e-lô
          : 1; // batida simples

      const label = isDouble(tile)
        ? closedBothEnds
          ? 'cruzada'
          : 'carroça'
        : closedBothEnds
          ? 'lá-e-lô'
          : 'batida';

      table.lastEvent = `${seat.name} bateu de ${label} — ${points} ponto(s) pra dupla ${seat.team}.`;
      table.lastHandStarter = seat.seatIndex;
      this.awardHand(table, seat.team, points);
    }
  }

  /** Mesa travada: vence a dupla com menor soma de pintas. Empate: perde quem travou. */
  private resolveBlockedHand(table: DominoOnlineTable) {
    const sumOf = (team: Team) =>
      table.seats.filter((seat) => seat.team === team).reduce((total, seat) => total + tileSum(seat.hand), 0);

    const sumA = sumOf('A');
    const sumB = sumOf('B');
    const blockerTeam = teamOfSeat(table.turnSeat);

    let winner: Team;
    if (sumA === sumB) {
      winner = blockerTeam === 'A' ? 'B' : 'A';
      table.lastEvent = `Mesa travada e contagem empatada em ${sumA} — quem travou perde.`;
    } else {
      winner = sumA < sumB ? 'A' : 'B';
      table.lastEvent = `Mesa travada — dupla A somou ${sumA}, dupla B somou ${sumB}. Dupla ${winner} venceu a mão.`;
    }

    table.lastHandStarter = table.seats.find((seat) => seat.team === winner)?.seatIndex ?? 0;
    this.awardHand(table, winner, 1);
  }

  private awardHand(table: DominoOnlineTable, winner: Team, points: number) {
    table.score[winner] += points;

    if (table.score[winner] >= POINTS_TO_WIN) {
      table.finished = true;
      table.winnerTeam = winner;
      const pot = table.buyIn * SEATS;
      const winners = table.seats.filter((seat) => seat.team === winner && !seat.isBot);
      const share = winners.length > 0 ? Math.floor(pot / winners.length) : 0;
      for (const seat of winners) this.walletService.credit(seat.userId, share, 'premio', GAME_ID);
      for (const seat of table.seats) {
        if (seat.isBot) continue;
        this.tournaments.recordRound(seat.userId, GAME_ID, table.buyIn, seat.team === winner ? share : 0);
      }
      table.lastEvent = `${table.lastEvent ?? ''} Dupla ${winner} venceu a partida!`.trim();
      return;
    }

    this.dealNewHand(table);
  }

  private dealNewHand(table: DominoOnlineTable) {
    const tiles = shuffle(buildTileSet());
    for (const seat of table.seats) {
      seat.hand = tiles.splice(0, HAND_SIZE);
    }

    table.board = [];
    table.leftEnd = null;
    table.rightEnd = null;
    table.consecutivePasses = 0;
    // Sem isso, o "Fulano bateu" da mão anterior ficaria na tela a mão inteira.
    table.lastEvent = 'Mão nova.';

    // Na primeira mão começa quem tem a maior carroça; depois, quem bateu antes.
    if (table.lastHandStarter >= 0) {
      table.turnSeat = table.lastHandStarter;
    } else {
      table.turnSeat = this.seatWithHighestDouble(table);
    }

    this.autoPlayBots(table);
  }

  private seatWithHighestDouble(table: DominoOnlineTable): number {
    let bestSeat = 0;
    let bestValue = -1;
    for (const seat of table.seats) {
      for (const tile of seat.hand) {
        if (isDouble(tile) && tile.a > bestValue) {
          bestValue = tile.a;
          bestSeat = seat.seatIndex;
        }
      }
    }
    return bestSeat;
  }

  private advanceTurn(table: DominoOnlineTable) {
    table.turnSeat = (table.turnSeat + 1) % SEATS;
  }

  /** Bots jogam sozinhos até a vez cair num humano. */
  private autoPlayBots(table: DominoOnlineTable) {
    let guard = 0;
    while (guard < SEATS * HAND_SIZE * 2 && !table.finished) {
      const seat = table.seats.find((item) => item.seatIndex === table.turnSeat);
      if (!seat || !seat.isBot) return;

      if (!canPlay(seat.hand, table.leftEnd, table.rightEnd)) {
        table.consecutivePasses += 1;
        table.lastEvent = `${seat.name} passou a vez.`;
        if (table.consecutivePasses >= SEATS) {
          this.resolveBlockedHand(table);
          return;
        }
        this.advanceTurn(table);
        guard += 1;
        continue;
      }

      // Livra a peça de maior soma, igual ao bot do modo contra máquina.
      let bestIndex = -1;
      let bestEnd: BoardEnd = 'direita';
      let bestWeight = -1;
      seat.hand.forEach((tile, index) => {
        const weight = tile.a + tile.b;
        if (table.board.length === 0) {
          if (weight > bestWeight) {
            bestWeight = weight;
            bestIndex = index;
            bestEnd = 'direita';
          }
          return;
        }
        if (table.leftEnd !== null && tileMatches(tile, table.leftEnd) && weight > bestWeight) {
          bestWeight = weight;
          bestIndex = index;
          bestEnd = 'esquerda';
        }
        if (table.rightEnd !== null && tileMatches(tile, table.rightEnd) && weight > bestWeight) {
          bestWeight = weight;
          bestIndex = index;
          bestEnd = 'direita';
        }
      });

      if (bestIndex === -1) return;
      this.placeTile(table, seat, bestIndex, bestEnd);
      if (table.finished) return;
      this.advanceTurn(table);
      guard += 1;
    }
  }

  private seatPlayer(table: DominoOnlineTable, userId: string): DominoOnlineTable {
    if (table.seats.some((seat) => seat.userId === userId)) return table;
    if (table.started) throw new BadRequestException('A partida já começou.');
    if (table.seats.length >= SEATS) throw new BadRequestException('Mesa cheia.');

    const user = this.requireUser(userId);
    const seatIndex = this.nextFreeSeat(table);
    table.seats.push({ seatIndex, userId, name: user.name, isBot: false, team: teamOfSeat(seatIndex), hand: [] });
    return table;
  }

  private nextFreeSeat(table: DominoOnlineTable): number {
    const taken = new Set(table.seats.map((seat) => seat.seatIndex));
    for (let index = 0; index < SEATS; index += 1) {
      if (!taken.has(index)) return index;
    }
    throw new BadRequestException('Mesa cheia.');
  }

  private requireTable(tableId: string): DominoOnlineTable {
    const table = this.tables.get(tableId);
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    return table;
  }

  private requireSeat(table: DominoOnlineTable, userId: string): DominoSeat {
    const seat = table.seats.find((item) => item.userId === userId);
    if (!seat) throw new ForbiddenException('Você não está nessa mesa.');
    return seat;
  }

  private requireHost(table: DominoOnlineTable, userId: string) {
    if (table.hostUserId !== userId) throw new ForbiddenException('Só quem criou a mesa pode fazer isso.');
  }

  private requireUser(userId: string) {
    const user = this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
