export interface SlotSymbol {
  id: string;
  label: string;
  /** Peso relativo — quanto maior, mais comum. Não precisa somar 100, é normalizado. */
  weight: number;
  /** Multiplicador do valor apostado quando o símbolo forma uma trinca numa linha. */
  payout3: number;
}

/**
 * Grade 3x3, células numeradas em linha (0 a 8):
 *   0 1 2
 *   3 4 5
 *   6 7 8
 * Corresponde aos 9 símbolos descritos em docs/briefing-imagens-casino-inova.md
 * (simbolos-slot.png) — trocar o `label` pela arte real não muda nenhum número aqui.
 *
 * Pesos e prêmios abaixo foram calibrados (ver `theoreticalRtp` e o teste que a
 * acompanha) para um RTP teórico de ~89%. É um valor de partida razoável para um
 * slot social — ajustar depois de ter dados reais de jogo é esperado, mas o número
 * é sempre exato e conferível a partir desta tabela, nunca escondido.
 */
export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { id: 'ferradura', label: 'Ferradura', weight: 22, payout3: 3 },
  { id: 'sino', label: 'Sino', weight: 20, payout3: 5 },
  { id: 'barras', label: 'Barras', weight: 18, payout3: 7 },
  { id: 'estrela', label: 'Estrela', weight: 14, payout3: 10 },
  { id: 'moeda', label: 'Moeda', weight: 12, payout3: 14 },
  { id: 'coroa', label: 'Coroa', weight: 7, payout3: 25 },
  { id: 'diamante', label: 'Diamante', weight: 4, payout3: 50 },
  { id: 'sete', label: 'Sete', weight: 2.5, payout3: 100 },
  { id: 'jackpot', label: 'Jackpot', weight: 0.5, payout3: 350 },
] as const;

export interface Payline {
  name: string;
  /** Os 3 índices de célula (0-8) que compõem a linha. */
  cells: readonly [number, number, number];
}

export const PAYLINES: readonly Payline[] = [
  { name: 'linha-superior', cells: [0, 1, 2] },
  { name: 'linha-central', cells: [3, 4, 5] },
  { name: 'linha-inferior', cells: [6, 7, 8] },
  { name: 'diagonal-descendente', cells: [0, 4, 8] },
  { name: 'diagonal-ascendente', cells: [6, 4, 2] },
] as const;

export const MIN_BET = 50;
export const MAX_BET = 5000;
