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

/**
 * Os naipes, só pra desenhar a carta na tela.
 *
 * O baralho do blackjack aqui é "infinito": cada carta é sorteada com reposição, então
 * naipe não muda valor nenhum e não dá pra contar carta. Mesmo assim o naipe é sorteado
 * DE VERDADE no servidor e mandado junto — o app tem 52 imagens de carta, e desenhar
 * uma delas sem que ela tenha sido sorteada seria a tela mostrando uma carta que não
 * saiu. Custa um sorteio a mais e mantém a regra de que a tela nunca inventa.
 */
export const NAIPES = ['copas', 'ouros', 'espadas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];
