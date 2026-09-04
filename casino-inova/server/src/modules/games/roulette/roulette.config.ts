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
  | 'duzia3'
  /*
   * AS COLUNAS. São as três casas "2:1" no fim de cada fileira da mesa: a coluna 1 são
   * os números que caem em 3n+1 (1, 4, 7... 34), a 2 em 3n+2 e a 3 os múltiplos de 3.
   *
   * Faltavam. A mesa impressa sempre teve as três casas, e a tela não deixava apostar
   * nelas — o jogador via na arte uma aposta que o jogo não aceitava. Pagam 3x o total
   * (o "2 para 1" da mesa), como as dúzias, e por doze números em 37 dão o mesmo
   * 36/37 de sempre.
   */
  | 'coluna1'
  | 'coluna2'
  | 'coluna3';

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
  coluna1: 3,
  coluna2: 3,
  coluna3: 3,
};

/**
 * Quantas apostas cabem numa rodada.
 *
 * Numa mesa de verdade não há limite de casas: quem quiser cobre o pano inteiro. O teto
 * aqui não é regra de jogo, é proteção do servidor — impede que um pedido forjado mande
 * cem mil apostas e faça a rodada custar o processo. Trinta e sete números mais as doze
 * casas de fora dão 49; cem deixa folga pra qualquer jogada humana.
 */
export const MAXIMO_DE_APOSTAS_POR_RODADA = 100;
