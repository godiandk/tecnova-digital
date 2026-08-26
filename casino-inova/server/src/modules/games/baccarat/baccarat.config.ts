export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

/** Baralho "infinito" (cada carta sorteada com reposição) — mesma simplificação do blackjack. */

export type BaccaratBetType = 'jogador' | 'banca' | 'empate';

/**
 * Retorno TOTAL sobre a aposta (já inclui a devolução da ficha apostada).
 * "Banca" paga com 5% de comissão — a casa embolsa 5% do lucro, é a regra padrão do
 * Punto Banco (sem isso, apostar em "banca" venceria mais vezes que "jogador" sem
 * nenhuma desvantagem, porque a regra de compra da 3ª carta favorece levemente a banca).
 */
export const PLAYER_TOTAL_MULTIPLIER = 2;
export const BANKER_TOTAL_MULTIPLIER = 1.95;
export const TIE_TOTAL_MULTIPLIER = 9;
/** Se sai empate e você apostou em jogador/banca, sua ficha só volta — não ganha nem perde. */
export const PUSH_TOTAL_MULTIPLIER = 1;

export const MIN_BET = 50;
export const MAX_BET = 5000;
