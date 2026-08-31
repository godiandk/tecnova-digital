export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

/**
 * As cartas saem de uma sapata de 8 baralhos, sem reposição (ver shared/sapata.ts).
 * Antes era baralho infinito, que é honesto mas não é a mesa: nele nenhuma carta acaba
 * e tirar um Ás não deixa o próximo mais raro.
 */

/** O dealer para em qualquer 17, inclusive o soft 17. É a regra boa pro jogador (S17). */
export const DEALER_STANDS_ON = 17;

/** Blackjack natural paga 3 pra 2 — 2,5x contando a ficha de volta. */
export const BLACKJACK_PAYOUT_MULTIPLIER = 2.5;
export const WIN_PAYOUT_MULTIPLIER = 2;
export const PUSH_PAYOUT_MULTIPLIER = 1;

/**
 * O seguro é uma aposta paralela, oferecida só quando o dealer mostra Ás: custa até
 * metade da aposta e paga 2 pra 1 se a carta escondida valer 10.
 *
 * Vale dizer com todas as letras, porque a tela também diz: o seguro é a PIOR aposta da
 * mesa. Pagando 2:1 numa carta que tem menos de 1 chance em 3 de valer 10, ele tem
 * vantagem da casa de uns 7% — quase quinze vezes a do jogo normal. Está aqui porque a
 * mesa de verdade oferece, não porque compensa, e o app não vai fingir que compensa.
 */
export const INSURANCE_PAYOUT_MULTIPLIER = 3;
export const INSURANCE_MAX_FRACTION = 0.5;

/** Até quantas mãos o split pode gerar. Quatro é o padrão de cassino. */
export const MAX_HANDS = 4;

export const MIN_BET = 50;
export const MAX_BET = 5000;
