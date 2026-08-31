import {
  BLACKJACK_PAYOUT_MULTIPLIER,
  DEALER_STANDS_ON,
  MAX_HANDS,
  PUSH_PAYOUT_MULTIPLIER,
  Rank,
  WIN_PAYOUT_MULTIPLIER,
} from './blackjack.config';

export type Outcome = 'jogador-ganhou' | 'dealer-ganhou' | 'empate';

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

/** Mão "mole": tem um Ás ainda valendo 11, então não estoura na próxima carta. */
export function isSoft(cards: Rank[]): boolean {
  const semAjuste = cards.reduce((sum, card) => sum + rankValue(card), 0);
  return cards.includes('A') && semAjuste <= 21;
}

export function isBust(cards: Rank[]): boolean {
  return handValue(cards) > 21;
}

/**
 * Blackjack natural: 21 nas DUAS primeiras cartas, e só na mão original.
 * Vinte e um depois de dividir vale 21, não blackjack — é regra de cassino, e é por
 * isso que `deSplit` existe aqui.
 */
export function isNatural(cards: Rank[], deSplit = false): boolean {
  return !deSplit && cards.length === 2 && handValue(cards) === 21;
}

/** Duas cartas de mesmo valor de contagem: 8-8 dá, K-10 dá (as duas valem 10). */
export function isPair(cards: Rank[]): boolean {
  return cards.length === 2 && rankValue(cards[0]) === rankValue(cards[1]);
}

/**
 * Dobrar: só nas duas primeiras cartas da mão. Depois de dividir também vale (é a regra
 * "double after split", que é boa pro jogador), menos em mão de Ás dividido, que já
 * recebeu a carta única dela.
 */
export function canDouble(cards: Rank[], deSplitDeAses: boolean): boolean {
  return cards.length === 2 && !deSplitDeAses;
}

/** Dividir: par nas duas primeiras cartas, e ainda cabendo mão nova no limite da mesa. */
export function canSplit(cards: Rank[], quantasMaos: number, deSplitDeAses: boolean): boolean {
  return isPair(cards) && quantasMaos < MAX_HANDS && !deSplitDeAses;
}

/** O dealer compra até `DEALER_STANDS_ON`. Para em qualquer 17, inclusive o soft 17. */
export function dealerShouldDraw(cards: Rank[]): boolean {
  return handValue(cards) < DEALER_STANDS_ON;
}

export interface Resolution {
  outcome: Outcome;
  /** Retorno TOTAL sobre a aposta desta mão (0 = perdeu, 1x = empate, 2x = ganhou, 2,5x = blackjack). */
  totalReturn: number;
}

/**
 * Resolve UMA mão contra o dealer. `bet` é a aposta desta mão — depois de dobrar ela já
 * vem dobrada, e depois de dividir cada mão traz a sua.
 */
export function resolveHand(
  playerCards: Rank[],
  dealerCards: Rank[],
  bet: number,
  deSplit = false,
): Resolution {
  // Estourar perde na hora, mesmo que o dealer estoure depois. É a vantagem da casa.
  if (isBust(playerCards)) {
    return { outcome: 'dealer-ganhou', totalReturn: 0 };
  }

  const playerNatural = isNatural(playerCards, deSplit);
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
