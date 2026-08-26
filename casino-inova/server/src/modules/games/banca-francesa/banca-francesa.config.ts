/**
 * Banca Francesa "de verdade" usa 3 dados de 6 faces (é o que distingue ela de um
 * jogo de 2 dados) — o jogador aposta num ou mais números de 1 a 6, e o prêmio
 * depende de quantos dos 3 dados caem no número apostado.
 */
export const DICE_COUNT = 3;
export const FACES = 6;

/** Retorno TOTAL sobre a aposta por quantidade de dados que bateram no número: 0 bateu = perde tudo. */
export const TOTAL_MULTIPLIER_BY_MATCHES: Record<number, number> = {
  0: 0,
  1: 2,
  2: 3,
  3: 4,
};

export const MIN_BET = 50;
export const MAX_BET = 5000;
/** Quantos números diferentes dá pra apostar na mesma rodada. */
export const MAX_SIMULTANEOUS_NUMBERS = 6;
