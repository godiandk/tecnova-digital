import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import {
  buildDeck,
  compareCards,
  ManilhaContext,
  manilhaRankFor,
  resolveHand,
  RoundResult,
  shuffle,
} from '../games/truco/truco.engine';
import {
  Card,
  MAX_BUY_IN,
  MIN_BUY_IN,
  nextHandValue,
  TRUCO_SIGNALS,
  TrucoRank,
  TrucoSignalId,
  TrucoStyle,
  TrucoVariant,
  VARIANT_RULES,
} from '../games/truco/truco.config';
import { generateTableCode } from './table-code';

/**
 * Mesa 2x2 de truco online — quatro pessoas de verdade, duas duplas.
 *
 * A diferença que mais importa em relação à mesa compartilhada de banca francesa:
 * aqui EXISTE informação escondida. Cada jogador só pode ver as próprias cartas, e a
 * conversa da dupla não pode vazar pros adversários. Por isso a mesa nunca é enviada
 * inteira: cada pessoa recebe uma visão montada pra ela (ver `viewFor`).
 *
 * Assentos e duplas: quem senta em 0 e 2 forma a dupla A, quem senta em 1 e 3 forma a
 * dupla B — parceiros ficam de frente um pro outro, igual mesa de verdade.
 */

export type TableVisibility = 'publica' | 'privada';
export type Team = 'A' | 'B';

export interface TrucoSeat {
  seatIndex: number;
  userId: string;
  name: string;
  isBot: boolean;
  team: Team;
  hand: Card[];
  /**
   * A pessoa caiu (ou saiu) no meio da partida. O assento CONTINUA sendo dela — só as
   * jogadas passam a sair automáticas, pra a mesa não travar esperando quem não volta.
   * Voltar limpa isto e ela retoma de onde parou.
   */
  ausente?: boolean;
}

export interface TrucoOnlineTable {
  id: string;
  code: string;
  visibility: TableVisibility;
  variant: TrucoVariant;
  style: TrucoStyle;
  hostUserId: string;
  buyIn: number;
  seats: TrucoSeat[];
  started: boolean;

  score: Record<Team, number>;
  handValue: number;
  pendingRaise: { toValue: number; byTeam: Team } | null;
  lastRaiseByTeam: Team | null;

  vira: Card | null;
  manilhaRank: TrucoRank | null;

  /** De quem é a vez, por índice de assento. */
  turnSeat: number;
  /** Cartas jogadas na rodada atual, na ordem em que caíram. */
  currentTrick: { seatIndex: number; card: Card }[];
  roundResults: RoundResult[];
  /** Quem começou a rodada atual (o "pé" da vez). */
  leadSeat: number;

  finished: boolean;
  winnerTeam?: Team;
  lastEvent?: string;
}

const SEATS = 4;

function teamOfSeat(seatIndex: number): Team {
  return seatIndex % 2 === 0 ? 'A' : 'B';
}

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'truco';

@Injectable()
export class TrucoTableService {
  private readonly tables = new Map<string, TrucoOnlineTable>();
  private nextId = 1;

  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  async createTable(
    hostUserId: string,
    options: { visibility: TableVisibility; variant?: TrucoVariant; style?: TrucoStyle; buyIn: number },
  ): Promise<TrucoOnlineTable> {
    const { visibility, variant = 'paulista', style = 'sujo', buyIn } = options;

    if (!VARIANT_RULES[variant]) throw new BadRequestException('Variante inválida.');
    if (style !== 'sujo' && style !== 'limpo') throw new BadRequestException('Estilo inválido.');
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }

    const host = (await this.requireUser(hostUserId));
    const table: TrucoOnlineTable = {
      id: `truco-${this.nextId}`,
      code: generateTableCode(),
      visibility,
      variant,
      style,
      hostUserId,
      buyIn,
      seats: [{ seatIndex: 0, userId: hostUserId, name: host.name, isBot: false, team: 'A', hand: [] }],
      started: false,
      score: { A: 0, B: 0 },
      handValue: VARIANT_RULES[variant].baseHandValue,
      pendingRaise: null,
      lastRaiseByTeam: null,
      vira: null,
      manilhaRank: null,
      turnSeat: 0,
      currentTrick: [],
      roundResults: [],
      leadSeat: 0,
      finished: false,
    };
    this.nextId += 1;
    this.tables.set(table.id, table);
    return table;
  }

  async listPublicTables() {
    return Promise.all(
      [...this.tables.values()]
      .filter((table) => table.visibility === 'publica' && !table.started && table.seats.length < SEATS)
      .map(async (table) => ({
        id: table.id,
        hostName: (await this.usersService.findById(table.hostUserId))?.name ?? table.hostUserId,
        seatedCount: table.seats.length,
        maxSeats: SEATS,
        variant: table.variant,
        style: table.style,
        buyIn: table.buyIn,
      })),
    );
  }

  async joinByCode(userId: string, code: string): Promise<TrucoOnlineTable> {
    const normalized = code.trim().toUpperCase();
    const table = [...this.tables.values()].find((item) => item.code === normalized);
    if (!table) throw new NotFoundException('Mesa não encontrada — confira o código.');
    return await this.seatPlayer(table, userId);
  }

  async joinById(userId: string, tableId: string): Promise<TrucoOnlineTable> {
    return await this.seatPlayer(this.requireTable(tableId), userId);
  }

  addBot(hostUserId: string, tableId: string): TrucoOnlineTable {
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

  /** Só o anfitrião começa, e só com os 4 assentos ocupados. Cobra o buy-in de cada humano. */
  async start(hostUserId: string, tableId: string): Promise<TrucoOnlineTable> {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostUserId);
    if (table.started) throw new BadRequestException('A partida já começou.');
    if (table.seats.length < SEATS) {
      throw new BadRequestException(`Faltam ${SEATS - table.seats.length} jogador(es) — complete com bot se quiser começar.`);
    }

    for (const seat of table.seats) {
      if (seat.isBot) continue;
      if (await this.walletService.balanceOf(seat.userId) < table.buyIn) {
        throw new BadRequestException(`${seat.name} não tem fichas suficientes pro buy-in.`);
      }
    }
    for (const seat of table.seats) {
      if (!seat.isBot) await this.walletService.debit(seat.userId, table.buyIn, 'aposta', GAME_ID);
    }

    table.started = true;
    this.dealNewHand(table);
    table.lastEvent = 'Partida começou!';
    return table;
  }

  async playCard(userId: string, tableId: string, card: Card): Promise<TrucoOnlineTable> {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (!table.started) throw new BadRequestException('A partida ainda não começou.');
    if (table.finished) throw new BadRequestException('A partida já acabou.');
    if (table.pendingRaise) throw new BadRequestException('Tem um pedido esperando resposta.');
    if (table.turnSeat !== seat.seatIndex) throw new BadRequestException('Não é a sua vez.');

    const cardIndex = seat.hand.findIndex((item) => item.rank === card.rank && item.suit === card.suit);
    if (cardIndex === -1) throw new BadRequestException('Essa carta não está na sua mão.');

    const [played] = seat.hand.splice(cardIndex, 1);
    table.currentTrick.push({ seatIndex: seat.seatIndex, card: played });

    if (table.currentTrick.length === SEATS) {
      await this.resolveTrick(table);
    } else {
      table.turnSeat = (table.turnSeat + 1) % SEATS;
      await this.autoPlayBots(table);
    }

    return table;
  }

  /** Pede o próximo degrau. Quem pediu por último não pode pedir de novo. */
  callRaise(userId: string, tableId: string): TrucoOnlineTable {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (!table.started || table.finished) throw new BadRequestException('A partida não está em andamento.');
    if (table.pendingRaise) throw new BadRequestException('Já tem um pedido esperando resposta.');
    if (table.lastRaiseByTeam === seat.team) {
      throw new BadRequestException('Sua dupla pediu por último — espere a outra pedir.');
    }

    const target = nextHandValue(table.variant, table.handValue);
    if (target === null) throw new BadRequestException('A mão já vale o máximo.');

    table.pendingRaise = { toValue: target, byTeam: seat.team };
    table.lastRaiseByTeam = seat.team;
    table.lastEvent = `${seat.name} pediu ${VARIANT_RULES[table.variant].raiseLabel[target] ?? target}!`;
    return table;
  }

  /**
   * Responder ao pedido. Só a dupla adversária responde — e qualquer um dos dois
   * pode, que é como funciona na mesa real.
   */
  async respondRaise(userId: string, tableId: string, response: 'aceitar' | 'correr' | 'aumentar'): Promise<TrucoOnlineTable> {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (!table.pendingRaise) throw new BadRequestException('Não tem pedido esperando resposta.');
    if (table.pendingRaise.byTeam === seat.team) {
      throw new BadRequestException('Quem responde é a dupla adversária.');
    }

    const asked = table.pendingRaise.toValue;
    const label = VARIANT_RULES[table.variant].raiseLabel[asked] ?? String(asked);

    if (response === 'correr') {
      // Correr entrega o valor do degrau ANTERIOR pra dupla que pediu.
      const winner = table.pendingRaise.byTeam;
      table.pendingRaise = null;
      table.lastEvent = `${seat.name} correu do ${label}.`;
      this.awardHand(table, winner);
      return table;
    }

    if (response === 'aceitar') {
      table.handValue = asked;
      table.pendingRaise = null;
      table.lastEvent = `${seat.name} aceitou o ${label} — a mão vale ${asked}.`;
      await this.autoPlayBots(table);
      return table;
    }

    const target = nextHandValue(table.variant, asked);
    if (target === null) throw new BadRequestException('O pedido já é o máximo — só dá pra aceitar ou correr.');

    table.handValue = asked;
    table.pendingRaise = { toValue: target, byTeam: seat.team };
    table.lastRaiseByTeam = seat.team;
    table.lastEvent = `${seat.name} aceitou e pediu ${VARIANT_RULES[table.variant].raiseLabel[target] ?? target}!`;
    return table;
  }

  /**
   * Sinal pro parceiro. Só existe em mesa suja — e o serviço só valida; quem entrega
   * pro socket certo (e só pro parceiro) é o gateway.
   */
  makeSignal(userId: string, tableId: string, signalId: TrucoSignalId) {
    const table = this.requireTable(tableId);
    const seat = this.requireSeat(table, userId);

    if (table.style === 'limpo') {
      throw new ForbiddenException('Esta mesa é de truco limpo — sinal não é permitido aqui.');
    }
    const signal = TRUCO_SIGNALS.find((item) => item.id === signalId);
    if (!signal) throw new BadRequestException('Sinal desconhecido.');

    const partner = this.partnerOf(table, seat);
    return { signal, fromName: seat.name, partnerUserId: partner?.userId ?? null };
  }

  /** O parceiro é quem está sentado de frente: dois assentos adiante. */
  partnerOf(table: TrucoOnlineTable, seat: TrucoSeat): TrucoSeat | undefined {
    return table.seats.find((item) => item.seatIndex === (seat.seatIndex + 2) % SEATS);
  }

  partnerUserIdOf(tableId: string, userId: string): string | undefined {
    const table = this.tables.get(tableId);
    if (!table) return undefined;
    const seat = table.seats.find((item) => item.userId === userId);
    if (!seat) return undefined;
    return this.partnerOf(table, seat)?.userId;
  }

  /**
   * Sair da mesa.
   *
   * Antes da partida começar, sair é sair: o assento some e, se não sobrar humano
   * nenhum, a mesa fecha.
   *
   * DEPOIS de começar é outra história. Os quatro buy-ins já foram debitados e o pote
   * só é pago no fim — então apagar a mesa nesse ponto (que era o que acontecia aqui)
   * destruía o dinheiro de QUATRO pessoas porque UMA saiu. Agora quem sai fica marcado
   * como ausente: as jogadas dele saem automáticas, a partida termina, e o pote é pago
   * a quem ganhou. Quem saiu perde a partida jogando mal, não a mesa inteira sumindo.
   */
  async leaveTable(userId: string, tableId: string): Promise<TrucoOnlineTable | { removed: true }> {
    const table = this.requireTable(tableId);

    if (table.started && !table.finished) {
      const seat = table.seats.find((item) => item.userId === userId);
      if (seat) {
        seat.ausente = true;
        table.lastEvent = `${seat.name} saiu da mesa — as jogadas dele saem automáticas.`;
        await this.autoPlayBots(table);
      }
      // Se TODO MUNDO saiu, não há mais o que jogar: a mesa some.
      if (table.seats.every((item) => item.isBot || item.ausente)) {
        this.tables.delete(table.id);
        return { removed: true };
      }
      return table;
    }

    table.seats = table.seats.filter((seat) => seat.userId !== userId);

    if (table.seats.filter((seat) => !seat.isBot).length === 0) {
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

  /** Em que mesas esta pessoa está sentada. Usado na queda, pra marcar ausência. */
  mesasDoJogador(userId: string): string[] {
    return [...this.tables.values()]
      .filter((mesa) => mesa.seats.some((assento) => assento.userId === userId))
      .map((mesa) => mesa.id);
  }

  buscarMesa(tableId: string): TrucoOnlineTable | undefined {
    return this.tables.get(tableId);
  }

  /**
   * Marca a queda e destrava a mesa.
   *
   * Diferente de `leaveTable`, isto não é decisão da pessoa — é rede. O assento fica
   * guardado pra ela voltar, mas as jogadas passam a sair automáticas na hora, senão a
   * mesa fica parada esperando quem talvez não volte, com o pote preso.
   */
  async marcarQueda(userId: string, tableId: string): Promise<TrucoOnlineTable | undefined> {
    const table = this.tables.get(tableId);
    if (!table || !table.started || table.finished) return table;
    const seat = table.seats.find((item) => item.userId === userId);
    if (!seat || seat.ausente) return table;

    seat.ausente = true;
    table.lastEvent = `${seat.name} caiu — as jogadas dele saem automáticas até voltar.`;
    await this.autoPlayBots(table);
    return table;
  }

  /** Voltou: retoma o assento e volta a decidir as próprias jogadas. */
  retomarAssento(userId: string, tableId: string): TrucoOnlineTable | undefined {
    const table = this.tables.get(tableId);
    const seat = table?.seats.find((item) => item.userId === userId);
    if (!table || !seat) return undefined;
    if (seat.ausente) {
      seat.ausente = false;
      table.lastEvent = `${seat.name} voltou pra mesa.`;
    }
    return table;
  }

  /**
   * A visão que UMA pessoa recebe. É aqui que a informação escondida é protegida:
   * a mão de cada um só vai pra ele mesmo; dos outros vai só a quantidade de cartas.
   */
  viewFor(table: TrucoOnlineTable, userId: string) {
    return {
      id: table.id,
      code: table.code,
      visibility: table.visibility,
      variant: table.variant,
      style: table.style,
      hostUserId: table.hostUserId,
      buyIn: table.buyIn,
      started: table.started,
      finished: table.finished,
      winnerTeam: table.winnerTeam,
      score: table.score,
      handValue: table.handValue,
      pendingRaise: table.pendingRaise,
      nextRaiseValue:
        table.pendingRaise || !table.started ? null : nextHandValue(table.variant, table.handValue),
      vira: table.vira,
      turnSeat: table.turnSeat,
      currentTrick: table.currentTrick,
      roundResults: table.roundResults,
      lastEvent: table.lastEvent,
      pointsToWin: VARIANT_RULES[table.variant].pointsToWinMatch,
      seats: table.seats.map((seat) => ({
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        name: seat.name,
        isBot: seat.isBot,
        ausente: Boolean(seat.ausente),
        team: seat.team,
        cardsInHand: seat.hand.length,
        // Só o dono vê as próprias cartas.
        hand: seat.userId === userId ? seat.hand : undefined,
        isYou: seat.userId === userId,
        isPartner: this.partnerOf(table, seat)?.userId === userId,
      })),
    };
  }

  getTable(tableId: string): TrucoOnlineTable | undefined {
    return this.tables.get(tableId);
  }

  // ---------- interno ----------

  private contextOf(table: TrucoOnlineTable): ManilhaContext {
    return { variant: table.variant, manilhaRank: table.manilhaRank };
  }

  /**
   * Resolve a vaza e, quando a mão fecha, paga.
   *
   * É `async` porque `awardHand` credita o pote, e essa espera precisa subir por toda a
   * cadeia até o handler. Antes ela era disparada e esquecida: o servidor respondia
   * "partida encerrada, dupla X venceu" antes de o dinheiro se mover. Na maioria das
   * vezes o crédito chegava logo depois e ninguém notava — em 2 de 6 partidas medidas,
   * não chegava a tempo, e um erro no pagamento virava rejeição silenciosa.
   */
  private async resolveTrick(table: TrucoOnlineTable) {
    const context = this.contextOf(table);
    let best = table.currentTrick[0];
    let tied = false;

    for (const play of table.currentTrick.slice(1)) {
      const comparison = compareCards(play.card, best.card, context);
      if (comparison > 0) {
        best = play;
        tied = false;
      } else if (comparison === 0 && teamOfSeat(play.seatIndex) !== teamOfSeat(best.seatIndex)) {
        // Empate só conta como empate se for entre duplas diferentes.
        tied = true;
      }
    }

    const winnerTeam = teamOfSeat(best.seatIndex);
    table.roundResults.push(tied ? 'empate' : winnerTeam === 'A' ? 'jogador' : 'bot');
    table.lastEvent = tied ? 'Rodada empatou.' : `Dupla ${winnerTeam} levou a rodada.`;

    table.currentTrick = [];
    // Quem ganhou a rodada começa a próxima.
    table.leadSeat = tied ? table.leadSeat : best.seatIndex;
    table.turnSeat = table.leadSeat;

    const outcome = resolveHand(table.roundResults);
    if (outcome !== 'pendente') {
      await this.awardHand(table, outcome === 'ninguem' ? null : outcome === 'jogador' ? 'A' : 'B');
      return;
    }
    await this.autoPlayBots(table);
  }

  private async awardHand(table: TrucoOnlineTable, winner: Team | null) {
    if (winner) {
      table.score[winner] += table.handValue;
      table.lastEvent = `${table.lastEvent ?? ''} Dupla ${winner} fez ${table.handValue} ponto(s).`.trim();
    } else {
      table.lastEvent = `${table.lastEvent ?? ''} Mão empatou — ninguém pontuou.`.trim();
    }

    const target = VARIANT_RULES[table.variant].pointsToWinMatch;
    if (table.score.A >= target || table.score.B >= target) {
      table.finished = true;
      table.winnerTeam = table.score.A >= target ? 'A' : 'B';
      // O pote é o buy-in de todos; a dupla vencedora divide.
      const pot = table.buyIn * SEATS;
      const winners = table.seats.filter((seat) => seat.team === table.winnerTeam && !seat.isBot);
      const share = winners.length > 0 ? Math.floor(pot / winners.length) : 0;
      for (const seat of winners) await this.walletService.credit(seat.userId, share, 'premio', GAME_ID);
      // Todo mundo que pagou buy-in disputou a rodada de torneio — quem perdeu
      // entra com retorno 0, que é o que vai puxar a pontuação dele pra baixo.
      for (const seat of table.seats) {
        if (seat.isBot) continue;
        const retorno = seat.team === table.winnerTeam ? share : 0;
        await this.tournaments.recordRound(seat.userId, GAME_ID, table.buyIn, retorno);
      }
      table.lastEvent = `Dupla ${table.winnerTeam} venceu a partida!`;
      return;
    }

    this.dealNewHand(table);
  }

  private async dealNewHand(table: TrucoOnlineTable) {
    const deck = shuffle(buildDeck());
    if (VARIANT_RULES[table.variant].hasVira) {
      const vira = deck.pop()!;
      table.vira = vira;
      table.manilhaRank = manilhaRankFor(vira);
    } else {
      table.vira = null;
      table.manilhaRank = null;
    }

    for (const seat of table.seats) {
      seat.hand = deck.splice(0, 3);
    }

    table.handValue = VARIANT_RULES[table.variant].baseHandValue;
    table.pendingRaise = null;
    table.lastRaiseByTeam = null;
    table.currentTrick = [];
    table.roundResults = [];
    table.lastEvent = 'Mão nova.';
    // A cada mão o "pé" gira um assento, igual mesa real.
    table.leadSeat = (table.leadSeat + 1) % SEATS;
    table.turnSeat = table.leadSeat;

    await this.autoPlayBots(table);
  }

  /**
   * Joga sozinho pelos assentos que não têm ninguém decidindo agora: os bots, e quem
   * caiu ou saiu no meio da partida.
   *
   * Incluir os ausentes é o que impede a partida de travar. Os quatro buy-ins são
   * debitados na largada e o pote só é pago no fim — então uma mesa parada na vez de
   * quem não volta é dinheiro de quatro pessoas preso pra sempre.
   */
  private async autoPlayBots(table: TrucoOnlineTable) {
    let guard = 0;
    while (guard < SEATS * 3 && !table.finished && !table.pendingRaise) {
      const seat = table.seats.find((item) => item.seatIndex === table.turnSeat);
      if (!seat || !(seat.isBot || seat.ausente) || seat.hand.length === 0) return;

      const context = this.contextOf(table);
      const opponentCard = table.currentTrick[table.currentTrick.length - 1]?.card;
      const sorted = [...seat.hand].sort((a, b) => compareCards(a, b, context));
      const chosen = opponentCard
        ? sorted.find((card) => compareCards(card, opponentCard, context) > 0) ?? sorted[0]
        : sorted[0];

      seat.hand = seat.hand.filter((card) => card !== chosen);
      table.currentTrick.push({ seatIndex: seat.seatIndex, card: chosen });

      if (table.currentTrick.length === SEATS) {
        await this.resolveTrick(table);
        return;
      }
      table.turnSeat = (table.turnSeat + 1) % SEATS;
      guard += 1;
    }
  }

  private async seatPlayer(table: TrucoOnlineTable, userId: string): Promise<TrucoOnlineTable> {
    if (table.seats.some((seat) => seat.userId === userId)) return table;
    if (table.started) throw new BadRequestException('A partida já começou.');
    if (table.seats.length >= SEATS) throw new BadRequestException('Mesa cheia.');

    const user = (await this.requireUser(userId));
    const seatIndex = this.nextFreeSeat(table);
    table.seats.push({
      seatIndex,
      userId,
      name: user.name,
      isBot: false,
      team: teamOfSeat(seatIndex),
      hand: [],
    });
    return table;
  }

  private nextFreeSeat(table: TrucoOnlineTable): number {
    const taken = new Set(table.seats.map((seat) => seat.seatIndex));
    for (let index = 0; index < SEATS; index += 1) {
      if (!taken.has(index)) return index;
    }
    throw new BadRequestException('Mesa cheia.');
  }

  private requireTable(tableId: string): TrucoOnlineTable {
    const table = this.tables.get(tableId);
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    return table;
  }

  private requireSeat(table: TrucoOnlineTable, userId: string): TrucoSeat {
    const seat = table.seats.find((item) => item.userId === userId);
    if (!seat) throw new ForbiddenException('Você não está nessa mesa.');
    return seat;
  }

  private requireHost(table: TrucoOnlineTable, userId: string) {
    if (table.hostUserId !== userId) throw new ForbiddenException('Só quem criou a mesa pode fazer isso.');
  }

  private async requireUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
