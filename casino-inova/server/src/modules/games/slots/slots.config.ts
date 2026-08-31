export interface SlotSymbol {
  id: string;
  label: string;
  /** Peso relativo — quanto maior, mais comum. Não precisa somar 100, é normalizado. */
  weight: number;
  /**
   * Multiplicador do valor apostado por quantos símbolos iguais saem seguidos numa
   * linha, contando sempre a partir do primeiro rolo (ver `spin`). Menos de 3 não paga.
   */
  payout: { 3: number; 4: number; 5: number };
}

/**
 * Cinco rolos por três fileiras, do jeito que slot de vídeo é de verdade. As 15 células
 * são numeradas em linha (0 a 14):
 *
 *    0  1  2  3  4
 *    5  6  7  8  9
 *   10 11 12 13 14
 *
 * Cada coluna é um rolo. Antes daqui era uma grade 3x3, que não é slot de vídeo nenhum
 * — toda a arte encomendada mostra cinco rolos, e a regra de "paga da esquerda pra
 * direita" só faz sentido com eles.
 */
export const REELS = 5;
export const ROWS = 3;
export const CELLS = REELS * ROWS;

/**
 * Os 9 símbolos descritos em docs/briefing-imagens-casino-inova.md (simbolos-slot.png) —
 * trocar o `label` pela arte real não muda nenhum número aqui.
 *
 * Pesos e prêmios foram calibrados (ver `theoreticalRtp`, e verify-rtp.ts que confere a
 * fórmula contra simulação) para um RTP teórico de ~89,2% — o mesmo patamar da grade
 * anterior, de propósito: mudar o formato do jogo não é desculpa pra piorar o retorno
 * de quem joga. O número é sempre exato e conferível a partir desta tabela, e é ele que
 * a tela mostra ao jogador; nada fica escondido.
 */
export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { id: 'ferradura', label: 'Ferradura', weight: 22, payout: { 3: 1, 4: 5, 5: 20 } },
  { id: 'sino', label: 'Sino', weight: 20, payout: { 3: 2, 4: 10, 5: 40 } },
  { id: 'barras', label: 'Barras', weight: 18, payout: { 3: 4, 4: 20, 5: 75 } },
  { id: 'estrela', label: 'Estrela', weight: 14, payout: { 3: 5, 4: 25, 5: 125 } },
  { id: 'moeda', label: 'Moeda', weight: 12, payout: { 3: 8, 4: 40, 5: 200 } },
  { id: 'coroa', label: 'Coroa', weight: 7, payout: { 3: 15, 4: 75, 5: 375 } },
  { id: 'diamante', label: 'Diamante', weight: 4, payout: { 3: 30, 4: 150, 5: 750 } },
  { id: 'sete', label: 'Sete', weight: 2.5, payout: { 3: 60, 4: 300, 5: 1500 } },
  { id: 'jackpot', label: 'Jackpot', weight: 0.5, payout: { 3: 200, 4: 1000, 5: 5000 } },
] as const;

export interface Payline {
  name: string;
  /** Uma célula por rolo, na ordem dos rolos — é isso que faz "da esquerda pra direita". */
  cells: readonly [number, number, number, number, number];
}

/**
 * As cinco linhas clássicas de um slot 5x3: as três fileiras retas, mais o V e o V
 * invertido. A ordem importa: `cells[0]` é sempre o rolo 1.
 */
export const PAYLINES: readonly Payline[] = [
  { name: 'linha-central', cells: [5, 6, 7, 8, 9] },
  { name: 'linha-superior', cells: [0, 1, 2, 3, 4] },
  { name: 'linha-inferior', cells: [10, 11, 12, 13, 14] },
  { name: 'vale', cells: [0, 6, 12, 8, 4] },
  { name: 'montanha', cells: [10, 6, 2, 8, 14] },
] as const;

/** Mínimo de símbolos iguais seguidos, a partir do rolo 1, pra linha pagar. */
export const MIN_MATCH = 3;

export const MIN_BET = 50;
export const MAX_BET = 5000;
