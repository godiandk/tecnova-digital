export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

/** Baralho "infinito" (cada carta sorteada com reposição) — sem contagem de carta possível, comum em blackjack social/digital. */
export const DEALER_STANDS_ON = 17;

/** Blackjack natural (21 com 2 cartas) paga 3:2 — retorno TOTAL de 2,5x o valor apostado. */
export const BLACKJACK_PAYOUT_MULTIPLIER = 2.5;
export const WIN_PAYOUT_MULTIPLIER = 2;
export const PUSH_PAYOUT_MULTIPLIER = 1;

export const MIN_BET = 50;
export const MAX_BET = 5000;

