import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { drawCard, handValue, isBust, isNatural, playDealer, resolve, Resolution } from './blackjack.engine';
import { BLACKJACK_PAYOUT_MULTIPLIER, DEALER_STANDS_ON, MAX_BET, MIN_BET, Rank } from './blackjack.config';

interface HandState {
  bet: number;
  playerCards: Rank[];
  dealerCards: Rank[];
  finished: boolean;
}

/**
 * Uma mão passa por várias chamadas (apostar → pedir carta* → parar), então precisa
 * de estado entre requisições — igual ao saldo, fica em memória nesta v1 e some se o
 * servidor reiniciar. Uma tabela `blackjack_hands` no Postgres resolve isso na Fase 0 real.
 */
@Injectable()
export class BlackjackService {
  private readonly hands = new Map<string, HandState>();

  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      blackjackPayoutMultiplier: BLACKJACK_PAYOUT_MULTIPLIER,
      dealerStandsOn: DEALER_STANDS_ON,
    };
  }

  startHand(userId: string, bet: number) {
    const existing = this.hands.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma mão em andamento — pare ou espere ela terminar antes de apostar de novo.');
    }
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    this.walletService.debit(userId, bet, 'aposta');
    const hand: HandState = { bet, playerCards: [drawCard(), drawCard()], dealerCards: [drawCard(), drawCard()], finished: false };
    this.hands.set(userId, hand);

    if (isNatural(hand.playerCards) || isNatural(hand.dealerCards)) {
      return this.finish(userId, hand);
    }
    return this.publicView(userId, hand);
  }

  hit(userId: string) {
    const hand = this.requireHand(userId);
    hand.playerCards.push(drawCard());
    if (isBust(hand.playerCards)) {
      return this.finish(userId, hand);
    }
    return this.publicView(userId, hand);
  }

  stand(userId: string) {
    const hand = this.requireHand(userId);
    hand.dealerCards = playDealer(hand.dealerCards);
    return this.finish(userId, hand);
  }

  private requireHand(userId: string): HandState {
    const hand = this.hands.get(userId);
    if (!hand || hand.finished) {
      throw new BadRequestException('Nenhuma mão em andamento — aposte primeiro.');
    }
    return hand;
  }

  private finish(userId: string, hand: HandState) {
    hand.finished = true;
    const resolution = resolve(hand.playerCards, hand.dealerCards, hand.bet);
    if (resolution.totalReturn > 0) {
      this.walletService.credit(userId, resolution.totalReturn, 'premio');
    }
    return this.publicView(userId, hand, resolution);
  }

  private publicView(userId: string, hand: HandState, resolution?: Resolution) {
    const dealerCards: (Rank | null)[] = hand.finished ? hand.dealerCards : [hand.dealerCards[0], null];
    return {
      playerCards: hand.playerCards,
      playerTotal: handValue(hand.playerCards),
      dealerCards,
      dealerTotal: hand.finished ? handValue(hand.dealerCards) : undefined,
      bet: hand.bet,
      finished: hand.finished,
      outcome: resolution?.outcome,
      totalReturn: resolution?.totalReturn,
      newBalance: this.walletService.balanceOf(userId),
    };
  }
}
