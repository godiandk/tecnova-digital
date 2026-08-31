import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { bestHandOf, botDecision, buildDeck, compareHandValues, handLabel, PokerAction, shuffle } from './poker.engine';
import { BIG_BET, BIG_BLIND, Card, MAX_BUY_IN, MAX_RAISES_PER_STREET, MIN_BUY_IN, SMALL_BET, SMALL_BLIND } from './poker.config';

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

interface PokerHand {
  userId: string;
  buyIn: number;
  playerStack: number;
  botStack: number;
  pot: number;
  deck: Card[];
  playerHole: Card[];
  botHole: Card[];
  board: Card[];
  street: Street;
  playerBetThisStreet: number;
  botBetThisStreet: number;
  raisesThisStreet: number;
  streetActionCount: number;
  toAct: 'jogador' | 'bot';
  allInRunout: boolean;
  finished: boolean;
  lastEvent?: string;
  outcome?: {
    winner: 'jogador' | 'bot' | 'empate';
    potWon: number;
    playerHandLabel?: string;
    botHandLabel?: string;
    playerHole: Card[];
    botHole: Card[];
  };
}

/**
 * Heads-up limit hold'em contra bot — mesma ressalva de truco/dominó: multiplayer de
 * verdade precisa de sala + WebSocket, que não existe neste esqueleto. É o jogo mais
 * complexo dos 8 (avaliador de mão + apostas em várias ruas), por isso é o último a
 * ganhar motor no roadmap.
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'poker';

@Injectable()
export class PokerService {
  private readonly hands = new Map<string, PokerHand>();

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  getConfig() {
    return { minBuyIn: MIN_BUY_IN, maxBuyIn: MAX_BUY_IN, smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND, smallBet: SMALL_BET, bigBet: BIG_BET };
  }

  async newHand(userId: string, buyIn: number, actionId?: string) {
    const existing = this.hands.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma mão de poker em andamento.');
    }
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }

    await this.walletService.debit(userId, buyIn, 'aposta', GAME_ID, actionId);
    const deck = shuffle(buildDeck());
    const match: PokerHand = {
      userId,
      buyIn,
      playerStack: buyIn - SMALL_BLIND,
      botStack: buyIn - BIG_BLIND,
      pot: SMALL_BLIND + BIG_BLIND,
      deck,
      playerHole: deck.splice(0, 2),
      botHole: deck.splice(0, 2),
      board: [],
      street: 'preflop',
      playerBetThisStreet: SMALL_BLIND,
      botBetThisStreet: BIG_BLIND,
      raisesThisStreet: 0,
      streetActionCount: 0,
      toAct: 'jogador', // no heads-up, o botão (você) age primeiro no pré-flop
      allInRunout: false,
      finished: false,
      lastEvent: 'Cegas postadas — sua vez.',
    };
    this.hands.set(userId, match);
    return this.publicView(match);
  }

  act(userId: string, action: PokerAction) {
    const match = this.requireHand(userId);
    if (match.toAct !== 'jogador') {
      throw new BadRequestException('Não é sua vez.');
    }
    const legal = this.legalActions(match, 'jogador');
    if (!legal.includes(action)) {
      throw new BadRequestException(`Ação inválida agora — pode: ${legal.join(', ')}.`);
    }

    this.applyAction(match, 'jogador', action);
    this.runBotIfNeeded(match);
    return this.publicView(match);
  }

  private legalActions(match: PokerHand, actor: 'jogador' | 'bot'): PokerAction[] {
    const myBet = actor === 'jogador' ? match.playerBetThisStreet : match.botBetThisStreet;
    const otherBet = actor === 'jogador' ? match.botBetThisStreet : match.playerBetThisStreet;
    const myStack = actor === 'jogador' ? match.playerStack : match.botStack;
    const toCall = otherBet - myBet;

    const actions: PokerAction[] = ['desistir'];
    if (toCall <= 0) actions.push('passar');
    else if (myStack > 0) actions.push('pagar');
    if (myStack > 0 && !match.allInRunout && match.raisesThisStreet < MAX_RAISES_PER_STREET) actions.push('aumentar');
    return actions;
  }

  private applyAction(match: PokerHand, actor: 'jogador' | 'bot', action: PokerAction) {
    if (action === 'desistir') {
      match.lastEvent = actor === 'jogador' ? 'Você desistiu da mão.' : 'O bot desistiu da mão.';
      this.settleHand(match, actor === 'jogador' ? 'bot' : 'jogador');
      return;
    }

    const isPlayer = actor === 'jogador';
    const myBet = isPlayer ? match.playerBetThisStreet : match.botBetThisStreet;
    const otherBet = isPlayer ? match.botBetThisStreet : match.playerBetThisStreet;
    const myStack = isPlayer ? match.playerStack : match.botStack;

    let amount = 0;
    if (action === 'pagar') {
      amount = Math.min(otherBet - myBet, myStack);
    } else if (action === 'aumentar') {
      const betSize = match.street === 'preflop' || match.street === 'flop' ? SMALL_BET : BIG_BET;
      const target = otherBet + betSize;
      amount = Math.min(target - myBet, myStack);
      match.raisesThisStreet += 1;
    }

    if (isPlayer) {
      match.playerStack -= amount;
      match.playerBetThisStreet += amount;
    } else {
      match.botStack -= amount;
      match.botBetThisStreet += amount;
    }
    match.pot += amount;
    match.streetActionCount += 1;
    match.lastEvent = `${isPlayer ? 'Você' : 'O bot'} ${action === 'pagar' ? 'pagou' : 'aumentou'}.`;

    if (match.playerStack === 0 || match.botStack === 0) {
      match.allInRunout = true;
    }

    if (this.isStreetComplete(match)) {
      this.advanceStreet(match);
    } else {
      match.toAct = isPlayer ? 'bot' : 'jogador';
    }
  }

  private isStreetComplete(match: PokerHand): boolean {
    return match.streetActionCount >= 2 && match.playerBetThisStreet === match.botBetThisStreet;
  }

  private advanceStreet(match: PokerHand) {
    match.streetActionCount = 0;
    match.raisesThisStreet = 0;
    match.playerBetThisStreet = 0;
    match.botBetThisStreet = 0;

    if (match.street === 'preflop') {
      match.board.push(...match.deck.splice(0, 3));
      match.street = 'flop';
    } else if (match.street === 'flop') {
      match.board.push(...match.deck.splice(0, 1));
      match.street = 'turn';
    } else if (match.street === 'turn') {
      match.board.push(...match.deck.splice(0, 1));
      match.street = 'river';
    } else {
      this.goToShowdown(match);
      return;
    }

    match.toAct = 'bot'; // pós-flop, quem não é o botão (o bot) age primeiro
  }

  private goToShowdown(match: PokerHand) {
    match.street = 'showdown';
    const playerValue = bestHandOf([...match.playerHole, ...match.board]);
    const botValue = bestHandOf([...match.botHole, ...match.board]);
    const comparison = compareHandValues(playerValue, botValue);
    const winner = comparison > 0 ? 'jogador' : comparison < 0 ? 'bot' : 'empate';
    this.settleHand(match, winner, handLabel(playerValue), handLabel(botValue));
  }

  private async settleHand(match: PokerHand, winner: 'jogador' | 'bot' | 'empate', playerHandLabel?: string, botHandLabel?: string) {
    match.finished = true;
    let potWon = 0;

    if (winner === 'jogador') {
      potWon = match.pot;
      match.playerStack += match.pot;
    } else if (winner === 'bot') {
      potWon = match.pot;
      match.botStack += match.pot;
    } else {
      const half = Math.floor(match.pot / 2);
      match.playerStack += half;
      match.botStack += match.pot - half;
      potWon = half;
    }
    match.pot = 0;

    match.outcome = {
      winner,
      potWon,
      playerHandLabel,
      botHandLabel,
      playerHole: match.playerHole,
      botHole: match.botHole,
    };

    if (match.playerStack > 0) {
      await this.walletService.credit(match.userId, match.playerStack, 'premio', GAME_ID);
    }
    // O buy-in virou o stack da mão; o que sobrou dele é o retorno.
    await this.tournaments.recordRound(match.userId, GAME_ID, match.buyIn, match.playerStack);
  }

  private runBotIfNeeded(match: PokerHand, depth = 0) {
    if (match.finished || match.toAct !== 'bot' || depth > 10) return;

    const legal = this.legalActions(match, 'bot');
    const betToCall = Math.max(0, match.playerBetThisStreet - match.botBetThisStreet);
    let suggestion = botDecision(match.botHole, match.board, betToCall);

    if (!legal.includes(suggestion)) {
      suggestion = legal.includes('pagar') ? 'pagar' : legal.includes('passar') ? 'passar' : 'desistir';
    }

    this.applyAction(match, 'bot', suggestion);
    this.runBotIfNeeded(match, depth + 1);
  }

  private requireHand(userId: string): PokerHand {
    const match = this.hands.get(userId);
    if (!match || match.finished) {
      throw new BadRequestException('Nenhuma mão de poker em andamento — comece uma nova.');
    }
    return match;
  }

  private async publicView(match: PokerHand) {
    return {
      buyIn: match.buyIn,
      playerStack: match.playerStack,
      botStack: match.botStack,
      pot: match.pot,
      playerHole: match.playerHole,
      board: match.board,
      street: match.street,
      playerBetThisStreet: match.playerBetThisStreet,
      botBetThisStreet: match.botBetThisStreet,
      toAct: match.toAct,
      legalActions: match.finished ? [] : this.legalActions(match, 'jogador'),
      finished: match.finished,
      outcome: match.outcome,
      lastEvent: match.lastEvent,
      newBalance: await this.walletService.balanceOf(match.userId),
    };
  }
}
