import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import {
  buildDeck,
  botShouldCallTruco,
  botTrucoDecision,
  chooseBotCard,
  compareCards,
  ManilhaContext,
  manilhaRankFor,
  resolveHand,
  RoundResult,
  shuffle,
} from './truco.engine';
import {
  Card,
  MATCH_WIN_TOTAL_MULTIPLIER,
  MAX_BUY_IN,
  MIN_BUY_IN,
  MINEIRO_FIXED_MANILHAS,
  nextHandValue,
  TRUCO_SIGNALS,
  TrucoRank,
  TrucoSignalId,
  TrucoStyle,
  TrucoVariant,
  VARIANT_RULES,
} from './truco.config';

export type TrucoResponse = 'aceitar' | 'correr' | 'aumentar';

interface TrucoMatch {
  buyIn: number;
  playerScore: number;
  botScore: number;
  variant: TrucoVariant;
  style: TrucoStyle;
  handValue: number;
  /** Valor que o pedido em aberto quer alcançar — null quando não tem pedido pendente. */
  pendingHandValue: number | null;
  /** Quem pediu por último nesta mão: esse lado não pode aumentar de novo até o outro responder. */
  lastRaiseBy: 'jogador' | 'bot' | null;
  /** Só existe no paulista — no mineiro as manilhas são fixas e não tem vira. */
  vira: Card | null;
  manilhaRank: TrucoRank | null;
  playerHand: Card[];
  botHand: Card[];
  roundResults: RoundResult[];
  playerCardsPlayed: Card[];
  botCardsPlayed: Card[];
  pendingTruco: 'jogador' | 'bot' | null;
  finished: boolean;
  matchOutcome?: 'jogador' | 'bot';
  lastEvent?: string;
}

/**
 * Contra bot, não multiplayer de verdade ainda — truco/dominó/poker multiplayer
 * precisam de sala + WebSocket (Colyseus é a escolha do plano de produto), que ainda
 * não existe neste esqueleto. Isso já entrega as regras de verdade (manilha, força de
 * carta, desempate de mão, pedir truco) jogáveis sozinho, e é a base que o motor
 * multiplayer real vai reaproveitar quando existir sala.
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'truco';

@Injectable()
export class TrucoService {
  private readonly matches = new Map<string, TrucoMatch>();

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  getConfig() {
    return {
      minBuyIn: MIN_BUY_IN,
      maxBuyIn: MAX_BUY_IN,
      variants: VARIANT_RULES,
      defaultVariant: 'paulista' as TrucoVariant,
      styles: ['sujo', 'limpo'] as TrucoStyle[],
      defaultStyle: 'sujo' as TrucoStyle,
      mineiroFixedManilhas: MINEIRO_FIXED_MANILHAS,
      signals: TRUCO_SIGNALS,
    };
  }

  async newMatch(userId: string, buyIn: number, variant: TrucoVariant = 'paulista', style: TrucoStyle = 'sujo', actionId?: string) {
    const existing = this.matches.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma partida de truco em andamento.');
    }
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }
    if (!VARIANT_RULES[variant]) {
      throw new BadRequestException('Variante inválida — use "paulista" ou "mineiro".');
    }
    if (style !== 'sujo' && style !== 'limpo') {
      throw new BadRequestException('Estilo inválido — use "sujo" ou "limpo".');
    }

    await this.walletService.debit(userId, buyIn, 'aposta', GAME_ID, actionId);
    const match: TrucoMatch = {
      buyIn,
      variant,
      style,
      playerScore: 0,
      botScore: 0,
      handValue: VARIANT_RULES[variant].baseHandValue,
      pendingHandValue: null,
      lastRaiseBy: null,
      vira: null,
      manilhaRank: null,
      playerHand: [],
      botHand: [],
      roundResults: [],
      playerCardsPlayed: [],
      botCardsPlayed: [],
      pendingTruco: null,
      finished: false,
    };
    this.dealNewHand(match);
    this.matches.set(userId, match);
    return this.publicView(userId, match);
  }

  playCard(userId: string, card: Card) {
    const match = this.requireMatch(userId);
    if (match.pendingTruco) {
      throw new BadRequestException('Tem um pedido de truco esperando resposta — responda antes de jogar.');
    }
    const cardIndex = match.playerHand.findIndex((item) => item.rank === card.rank && item.suit === card.suit);
    if (cardIndex === -1) {
      throw new BadRequestException('Essa carta não está na sua mão.');
    }

    const [playedCard] = match.playerHand.splice(cardIndex, 1);
    match.playerCardsPlayed.push(playedCard);

    const botCard = chooseBotCard(match.botHand, playedCard, this.contextOf(match));
    match.botHand = match.botHand.filter((item) => item !== botCard);
    match.botCardsPlayed.push(botCard);

    const comparison = compareCards(playedCard, botCard, this.contextOf(match));
    match.roundResults.push(comparison > 0 ? 'jogador' : comparison < 0 ? 'bot' : 'empate');

    this.settleOrContinueHand(userId, match);
    return this.publicView(userId, match);
  }

  /** Pede o próximo degrau da escada (truco → seis → nove → doze) e já resolve a resposta do bot. */
  callTruco(userId: string) {
    const match = this.requireMatch(userId);
    if (match.pendingTruco) {
      throw new BadRequestException('Já tem um pedido esperando resposta.');
    }
    if (match.lastRaiseBy === 'jogador') {
      throw new BadRequestException('Você pediu por último — espere o bot pedir pra poder aumentar de novo.');
    }

    const target = nextHandValue(match.variant, match.handValue);
    if (target === null) {
      throw new BadRequestException('A mão já vale 12 — não dá pra aumentar mais.');
    }

    match.lastRaiseBy = 'jogador';
    this.resolveBotResponseToRaise(userId, match, target);
    return this.publicView(userId, match);
  }

  respondTruco(userId: string, response: TrucoResponse) {
    const match = this.requireMatch(userId);
    if (match.pendingTruco !== 'bot' || match.pendingHandValue === null) {
      throw new BadRequestException('Não tem pedido do bot esperando resposta.');
    }

    const asked = match.pendingHandValue;
    const askedLabel = this.labelFor(match, asked);

    if (response === 'correr') {
      // Correr entrega ao adversário o valor do degrau anterior, não o valor pedido.
      match.pendingTruco = null;
      match.pendingHandValue = null;
      this.awardHand(userId, match, 'bot');
      match.lastEvent = `Você correu do ${askedLabel} — o bot fica com a mão. ` + (match.lastEvent ?? '');
      return this.publicView(userId, match);
    }

    if (response === 'aceitar') {
      match.handValue = asked;
      match.pendingTruco = null;
      match.pendingHandValue = null;
      match.lastEvent = `Você aceitou o ${askedLabel} — a mão agora vale ${asked}.`;
      return this.publicView(userId, match);
    }

    const target = nextHandValue(match.variant, asked);
    if (target === null) {
      throw new BadRequestException('O pedido já é de 12 — só dá pra aceitar ou correr.');
    }

    // Aumentar = aceitar o pedido do bot e já subir mais um degrau em cima dele.
    match.handValue = asked;
    match.pendingTruco = null;
    match.pendingHandValue = null;
    match.lastRaiseBy = 'jogador';
    this.resolveBotResponseToRaise(userId, match, target);
    return this.publicView(userId, match);
  }

  /**
   * O bot responde a um pedido do jogador: corre, aceita, ou devolve subindo mais um
   * degrau (só devolve com mão forte, e nunca acima de doze).
   */
  private resolveBotResponseToRaise(userId: string, match: TrucoMatch, target: number) {
    const label = this.labelFor(match, target);

    if (!botTrucoDecision(match.botHand, this.contextOf(match))) {
      // Corre: o jogador leva o valor de ANTES do pedido.
      this.awardHand(userId, match, 'jogador');
      match.lastEvent = `O bot correu do ${label} — você fica com a mão. ` + (match.lastEvent ?? '');
      return;
    }

    const counter = nextHandValue(match.variant, target);
    if (counter !== null && botShouldCallTruco(match.botHand, this.contextOf(match))) {
      // Aceita e devolve: a mão passa a valer o pedido do jogador e o bot pede o próximo.
      match.handValue = target;
      match.pendingTruco = 'bot';
      match.pendingHandValue = counter;
      match.lastRaiseBy = 'bot';
      match.lastEvent = `O bot aceitou o ${label} e pediu ${this.labelFor(match, counter)}!`;
      return;
    }

    match.handValue = target;
    match.lastEvent = `O bot aceitou o ${label} — a mão agora vale ${target}.`;
  }

  /**
   * O que define a manilha nesta partida. No paulista sai da vira da mão; no mineiro
   * não tem vira, e o motor usa as quatro cartas fixas.
   */
  private contextOf(match: TrucoMatch): ManilhaContext {
    return { variant: match.variant, manilhaRank: match.manilhaRank };
  }

  /** Nome do pedido na linguagem da variante — "truco" vale 3 no paulista e 4 no mineiro. */
  private labelFor(match: TrucoMatch, value: number): string {
    return VARIANT_RULES[match.variant].raiseLabel[value] ?? String(value);
  }

  /**
   * Sinal pro parceiro (a "careta"). Só existe em mesa suja — no truco limpo combinar
   * sinal é considerado trapaça, então o servidor recusa em vez de deixar passar.
   *
   * Em partida contra bot não tem parceiro pra ver, então isto serve pra validar a
   * regra e já deixar pronto pro 2x2 online: lá o sinal vai só pro socket do parceiro.
   */
  makeSignal(userId: string, signalId: TrucoSignalId) {
    const match = this.requireMatch(userId);
    if (match.style === 'limpo') {
      throw new BadRequestException('Esta mesa é de truco limpo — sinal pro parceiro não é permitido aqui.');
    }
    const signal = TRUCO_SIGNALS.find((item) => item.id === signalId);
    if (!signal) {
      throw new BadRequestException('Sinal desconhecido.');
    }
    return { signal, sentTo: 'parceiro', note: 'Numa mesa 2x2 este sinal aparece só pro seu parceiro.' };
  }

  private settleOrContinueHand(userId: string, match: TrucoMatch) {
    const outcome = resolveHand(match.roundResults);
    if (outcome === 'pendente') {
      const target = nextHandValue(match.variant, match.handValue);
      const botCanRaise = match.lastRaiseBy !== 'bot' && target !== null;
      if (botCanRaise && botShouldCallTruco(match.botHand, this.contextOf(match))) {
        match.pendingTruco = 'bot';
        match.pendingHandValue = target;
        match.lastRaiseBy = 'bot';
        match.lastEvent = `O bot pediu ${this.labelFor(match, target!)}!`;
      }
      return;
    }
    this.awardHand(userId, match, outcome === 'ninguem' ? null : outcome);
  }

  private async awardHand(userId: string, match: TrucoMatch, winner: 'jogador' | 'bot' | null) {
    if (winner === 'jogador') match.playerScore += match.handValue;
    if (winner === 'bot') match.botScore += match.handValue;

    match.lastEvent =
      winner === 'jogador'
        ? `Você venceu a mão (+${match.handValue} ponto${match.handValue > 1 ? 's' : ''}).`
        : winner === 'bot'
          ? `O bot venceu a mão (+${match.handValue} ponto${match.handValue > 1 ? 's' : ''}).`
          : 'A mão empatou — ninguém pontuou.';

    const target = VARIANT_RULES[match.variant].pointsToWinMatch;
    if (match.playerScore >= target || match.botScore >= target) {
      match.finished = true;
      match.matchOutcome = match.playerScore >= target ? 'jogador' : 'bot';
      const retorno = match.matchOutcome === 'jogador' ? match.buyIn * MATCH_WIN_TOTAL_MULTIPLIER : 0;
      if (retorno > 0) {
        await this.walletService.credit(userId, retorno, 'premio', GAME_ID);
      }
      // No truco a rodada de torneio é a partida inteira: o buy-in é a aposta.
      await this.tournaments.recordRound(userId, GAME_ID, match.buyIn, retorno);
      return;
    }

    this.dealNewHand(match);
  }

  private dealNewHand(match: TrucoMatch) {
    const deck = shuffle(buildDeck());
    if (VARIANT_RULES[match.variant].hasVira) {
      const vira = deck.pop()!;
      match.vira = vira;
      match.manilhaRank = manilhaRankFor(vira);
    } else {
      // Mineiro não tem vira: as manilhas são as quatro cartas fixas da config.
      match.vira = null;
      match.manilhaRank = null;
    }
    match.playerHand = deck.splice(0, 3);
    match.botHand = deck.splice(0, 3);
    match.roundResults = [];
    match.playerCardsPlayed = [];
    match.botCardsPlayed = [];
    match.handValue = VARIANT_RULES[match.variant].baseHandValue;
    match.pendingTruco = null;
    match.pendingHandValue = null;
    match.lastRaiseBy = null;
  }

  private requireMatch(userId: string): TrucoMatch {
    const match = this.matches.get(userId);
    if (!match || match.finished) {
      throw new BadRequestException('Nenhuma partida de truco em andamento — comece uma nova.');
    }
    return match;
  }

  private async publicView(userId: string, match: TrucoMatch) {
    return {
      buyIn: match.buyIn,
      playerScore: match.playerScore,
      botScore: match.botScore,
      variant: match.variant,
      style: match.style,
      pointsToWinMatch: VARIANT_RULES[match.variant].pointsToWinMatch,
      handValue: match.handValue,
      pendingHandValue: match.pendingHandValue,
      /** Quanto o jogador pode pedir agora (null = não pode aumentar nesse momento). */
      nextRaiseValue:
        match.lastRaiseBy === 'jogador' || match.pendingTruco ? null : nextHandValue(match.variant, match.handValue),
      vira: match.vira,
      playerHand: match.playerHand,
      playerCardsPlayed: match.playerCardsPlayed,
      botCardsPlayed: match.botCardsPlayed,
      roundResults: match.roundResults,
      pendingTruco: match.pendingTruco,
      finished: match.finished,
      matchOutcome: match.matchOutcome,
      lastEvent: match.lastEvent,
      newBalance: await this.walletService.balanceOf(userId),
    };
  }
}
