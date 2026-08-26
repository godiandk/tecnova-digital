import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import {
  buildDeck,
  botShouldCallTruco,
  botTrucoDecision,
  chooseBotCard,
  compareCards,
  manilhaRankFor,
  resolveHand,
  RoundResult,
  shuffle,
} from './truco.engine';
import {
  BASE_HAND_VALUE,
  Card,
  MATCH_WIN_TOTAL_MULTIPLIER,
  MAX_BUY_IN,
  MIN_BUY_IN,
  POINTS_TO_WIN_MATCH,
  TRUCO_HAND_VALUE,
  TrucoRank,
} from './truco.config';

interface TrucoMatch {
  buyIn: number;
  playerScore: number;
  botScore: number;
  handValue: number;
  vira: Card;
  manilhaRank: TrucoRank;
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
 * Contra bot, não multiplayer de verdade ainda — truco/dominó/pôquer multiplayer
 * precisam de sala + WebSocket (Colyseus é a escolha do plano de produto), que ainda
 * não existe neste esqueleto. Isso já entrega as regras de verdade (manilha, força de
 * carta, desempate de mão, pedir truco) jogáveis sozinho, e é a base que o motor
 * multiplayer real vai reaproveitar quando existir sala.
 */
@Injectable()
export class TrucoService {
  private readonly matches = new Map<string, TrucoMatch>();

  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return { minBuyIn: MIN_BUY_IN, maxBuyIn: MAX_BUY_IN, pointsToWinMatch: POINTS_TO_WIN_MATCH, trucoHandValue: TRUCO_HAND_VALUE };
  }

  newMatch(userId: string, buyIn: number) {
    const existing = this.matches.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma partida de truco em andamento.');
    }
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }

    this.walletService.debit(userId, buyIn, 'aposta');
    const match: TrucoMatch = {
      buyIn,
      playerScore: 0,
      botScore: 0,
      handValue: BASE_HAND_VALUE,
      vira: { rank: '4', suit: 'ouros' },
      manilhaRank: '5',
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

    const botCard = chooseBotCard(match.botHand, playedCard, match.manilhaRank);
    match.botHand = match.botHand.filter((item) => item !== botCard);
    match.botCardsPlayed.push(botCard);

    const comparison = compareCards(playedCard, botCard, match.manilhaRank);
    match.roundResults.push(comparison > 0 ? 'jogador' : comparison < 0 ? 'bot' : 'empate');

    this.settleOrContinueHand(userId, match);
    return this.publicView(userId, match);
  }

  callTruco(userId: string) {
    const match = this.requireMatch(userId);
    if (match.pendingTruco) {
      throw new BadRequestException('Já tem um pedido de truco em aberto.');
    }
    if (match.handValue !== BASE_HAND_VALUE) {
      throw new BadRequestException('Truco já foi pedido nesta mão.');
    }

    const botAccepts = botTrucoDecision(match.botHand, match.manilhaRank);
    if (botAccepts) {
      match.handValue = TRUCO_HAND_VALUE;
      match.lastEvent = 'O bot aceitou o truco — a mão agora vale 3.';
    } else {
      this.awardHand(userId, match, 'jogador');
      match.lastEvent = 'O bot correu do truco — você fica com a mão. ' + (match.lastEvent ?? '');
    }
    return this.publicView(userId, match);
  }

  respondTruco(userId: string, accept: boolean) {
    const match = this.requireMatch(userId);
    if (match.pendingTruco !== 'bot') {
      throw new BadRequestException('Não tem pedido de truco do bot esperando resposta.');
    }

    if (accept) {
      match.handValue = TRUCO_HAND_VALUE;
      match.pendingTruco = null;
      match.lastEvent = 'Você aceitou o truco — a mão agora vale 3.';
    } else {
      match.pendingTruco = null;
      this.awardHand(userId, match, 'bot');
      match.lastEvent = 'Você correu do truco — o bot fica com a mão. ' + (match.lastEvent ?? '');
    }
    return this.publicView(userId, match);
  }

  private settleOrContinueHand(userId: string, match: TrucoMatch) {
    const outcome = resolveHand(match.roundResults);
    if (outcome === 'pendente') {
      if (botShouldCallTruco(match.botHand, match.manilhaRank) && match.handValue === BASE_HAND_VALUE) {
        match.pendingTruco = 'bot';
        match.lastEvent = 'O bot pediu truco!';
      }
      return;
    }
    this.awardHand(userId, match, outcome === 'ninguem' ? null : outcome);
  }

  private awardHand(userId: string, match: TrucoMatch, winner: 'jogador' | 'bot' | null) {
    if (winner === 'jogador') match.playerScore += match.handValue;
    if (winner === 'bot') match.botScore += match.handValue;

    match.lastEvent =
      winner === 'jogador'
        ? `Você venceu a mão (+${match.handValue} ponto${match.handValue > 1 ? 's' : ''}).`
        : winner === 'bot'
          ? `O bot venceu a mão (+${match.handValue} ponto${match.handValue > 1 ? 's' : ''}).`
          : 'A mão empatou — ninguém pontuou.';

    if (match.playerScore >= POINTS_TO_WIN_MATCH || match.botScore >= POINTS_TO_WIN_MATCH) {
      match.finished = true;
      match.matchOutcome = match.playerScore >= POINTS_TO_WIN_MATCH ? 'jogador' : 'bot';
      if (match.matchOutcome === 'jogador') {
        this.walletService.credit(userId, match.buyIn * MATCH_WIN_TOTAL_MULTIPLIER, 'premio');
      }
      return;
    }

    this.dealNewHand(match);
  }

  private dealNewHand(match: TrucoMatch) {
    const deck = shuffle(buildDeck());
    const vira = deck.pop()!;
    match.vira = vira;
    match.manilhaRank = manilhaRankFor(vira);
    match.playerHand = deck.splice(0, 3);
    match.botHand = deck.splice(0, 3);
    match.roundResults = [];
    match.playerCardsPlayed = [];
    match.botCardsPlayed = [];
    match.handValue = BASE_HAND_VALUE;
    match.pendingTruco = null;
  }

  private requireMatch(userId: string): TrucoMatch {
    const match = this.matches.get(userId);
    if (!match || match.finished) {
      throw new BadRequestException('Nenhuma partida de truco em andamento — comece uma nova.');
    }
    return match;
  }

  private publicView(userId: string, match: TrucoMatch) {
    return {
      buyIn: match.buyIn,
      playerScore: match.playerScore,
      botScore: match.botScore,
      handValue: match.handValue,
      vira: match.vira,
      playerHand: match.playerHand,
      playerCardsPlayed: match.playerCardsPlayed,
      botCardsPlayed: match.botCardsPlayed,
      roundResults: match.roundResults,
      pendingTruco: match.pendingTruco,
      finished: match.finished,
      matchOutcome: match.matchOutcome,
      lastEvent: match.lastEvent,
      newBalance: this.walletService.balanceOf(userId),
    };
  }
}
