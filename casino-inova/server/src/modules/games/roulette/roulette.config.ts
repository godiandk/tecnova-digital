/** Roleta europeia — 37 casas (0 a 36), zero único (sem "00" americano). */
export const POCKET_COUNT = 37;

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type PocketColor = 'vermelho' | 'preto' | 'verde';

export function colorOf(pocket: number): PocketColor {
  if (pocket === 0) return 'verde';
  return RED_NUMBERS.has(pocket) ? 'vermelho' : 'preto';
}

export type RouletteBetType =
  | 'numero'
  | 'vermelho'
  | 'preto'
  | 'par'
  | 'impar'
  | 'baixo'
  | 'alto'
  | 'duzia1'
  | 'duzia2'
  | 'duzia3';

export interface RouletteBet {
  type: RouletteBetType;
  /** Só usado (e obrigatório) quando type === 'numero': o número exato, 0 a 36. */
  number?: number;
}

/**
 * Multiplicador de retorno TOTAL sobre a aposta (já inclui a devolução da própria
 * ficha apostada) — não é a notação "35 para 1" da mesa física, que é só o lucro.
 * "numero" aqui = 36x o valor apostado no total, equivalente a "35 para 1".
 */
export const TOTAL_MULTIPLIER: Record<RouletteBetType, number> = {
  numero: 36,
  vermelho: 2,
  preto: 2,
  par: 2,
  impar: 2,
  baixo: 2,
  alto: 2,
  duzia1: 3,
  duzia2: 3,
  duzia3: 3,
};

export const MIN_BET = 50;
export const MAX_BET = 5000;
