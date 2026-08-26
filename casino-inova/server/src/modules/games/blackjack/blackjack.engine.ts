import {
  BLACKJACK_PAYOUT_MULTIPLIER,
  DEALER_STANDS_ON,
  PUSH_PAYOUT_MULTIPLIER,
  Rank,
  RANKS,
  WIN_PAYOUT_MULTIPLIER,
} from './blackjack.config';

export type Outcome = 'jogador-ganhou' | 'dealer-ganhou' | 'empate';

export function drawCard(random: () => number = Math.random): Rank {
  return RANKS[Math.floor(random() * RANKS.length)];
}

function rankValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** Conta Ás como 11 e vai rebaixando pra 1 enquanto estourar 21 — a regra padrão. */
export function handValue(cards: Rank[]): number {
  let total = cards.reduce((sum, card) => sum + rankValue(card), 0);
  let aces = cards.filter((card) => card === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isBust(cards: Rank[]): boolean {
  return handValue(cards) > 21;
}

export function isNatural(cards: Rank[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

/** Dealer compra até estourar `DEALER_STANDS_ON` — para em qualquer 17, inclusive soft 17. */
export function playDealer(dealerCards: Rank[], random: () => number = Math.random): Rank[] {
  const cards = [...dealerCards];
  while (handValue(cards) < DEALER_STANDS_ON) {
    cards.push(drawCard(random));
  }
  return cards;
}

export interface Resolution {
  outcome: Outcome;
  /** Retorno TOTAL sobre a aposta (0 = perdeu tudo, 1x = empate, 2x = vitória normal, 2,5x = blackjack natural). */
  totalReturn: number;
}

export function resolve(playerCards: Rank[], dealerCards: Rank[], bet: number): Resolution {
  if (isBust(playerCards)) {
    return { outcome: 'dealer-ganhou', totalReturn: 0 };
  }

  const playerNatural = isNatural(playerCards);
  const dealerNatural = isNatural(dealerCards);

  if (playerNatural && dealerNatural) {
    return { outcome: 'empate', totalReturn: bet * PUSH_PAYOUT_MULTIPLIER };
  }
  if (playerNatural) {
    return { outcome: 'jogador-ganhou', totalReturn: bet * BLACKJACK_PAYOUT_MULTIPLIER };
  }
  if (dealerNatural) {
    return { outcome: 'dealer-ganhou', totalReturn: 0 };
  }
  if (isBust(dealerCards)) {
    return { outcome: 'jogador-ganhou', totalReturn: bet * WIN_PAYOUT_MULTIPLIER };
  }

  const playerTotal = handValue(playerCards);
  const dealerTotal = handValue(dealerCards);
  if (playerTotal > dealerTotal) {
    return { outcome: 'jogador-ganhou', totalReturn: bet * WIN_PAYOUT_MULTIPLIER };
  }
  if (playerTotal < dealerTotal) {
    return { outcome: 'dealer-ganhou', totalReturn: 0 };
  }
  return { outcome: 'empate', totalReturn: bet * PUSH_PAYOUT_MULTIPLIER };
}
