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
 * ESTA TABELA FOI RECALIBRADA. A anterior devolvia 89,17% e, pior que o número, tinha a
 * FORMA errada. O diagnóstico saiu de `tools/analisa-slot.py`, que calcula a distribuição
 * exata do retorno de um giro (não simulada) por programação dinâmica sobre os rolos:
 *
 *   - vitória em 13,73% dos giros — um em 7,3. Slot de vídeo de verdade fica entre 20% e
 *     30%, e abaixo disso o jogo só drena;
 *   - o maior prêmio saía uma vez a cada 3,3 x 10^34 giros. Não era prêmio, era enfeite:
 *     não seria pago uma vez na história do aplicativo;
 *   - 80% do retorno vinha dos quatro símbolos mais comuns, e o Jackpot inteiro
 *     contribuía 0,013 ponto de RTP. A escada de prêmios existia só no papel.
 *
 * O QUE MUDOU, e por quê:
 *
 * 1. PESOS MAIS CONCENTRADOS nos comuns (Ferradura foi de 22 pra 33, Sino de 20 pra 22).
 *    A frequência de vitória depende da soma dos p³, e essa soma sobe quando a
 *    distribuição é menos uniforme. Resultado: 21,72% de giros com prêmio, um em 4,6.
 * 2. PRÊMIOS DE CIMA ALCANÇÁVEIS. O Jackpot subiu de peso 0,5 pra 3 (p = 3%), e cinco
 *    Jackpots numa linha passaram de uma vez a cada 320 bilhões de giros pra uma a cada
 *    8,2 milhões. Continua raro — é um jackpot — mas agora existe.
 * 3. ESCADA DE PRÊMIOS REAL. Cada símbolo contribui entre 4,7 e 27 pontos de RTP, em vez
 *    de um contribuir 25 e outro 0,013. Repartição: 70% nos quatro comuns, 20% nos três
 *    do meio, 10% nos dois de cima.
 *
 * RTP: 95,9715% — margem da casa de 4,03%. O número é exato e sai desta tabela por
 * fórmula fechada (`theoreticalRtp`), conferido contra a distribuição exata e contra
 * meio milhão de giros simulados em `verify-rtp.ts`, que REPROVA se sair da faixa.
 *
 * UMA CONSEQUÊNCIA QUE A TELA PRECISA RESPEITAR: 9,59% dos giros devolvem ALGUMA COISA
 * abaixo da aposta (a média dessa faixa é 0,39x). Isso é como todo slot funciona, e não
 * há como evitar sem derrubar a frequência de vitória. Mas devolver 40 de uma aposta de
 * 100 NÃO É GANHAR, e a tela não pode comemorar como se fosse — é exatamente a "derrota
 * disfarçada de vitória" que este projeto não faz. A apresentação disso é tarefa da
 * interface, e está anotada como tal.
 */
export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { id: 'ferradura', label: 'Ferradura', weight: 33, payout: { 3: 0.35, 4: 1.8, 5: 8 } },
  { id: 'sino', label: 'Sino', weight: 22, payout: { 3: 1.5, 4: 7, 5: 35 } },
  { id: 'barras', label: 'Barras', weight: 13, payout: { 3: 5, 4: 25, 5: 140 } },
  { id: 'estrela', label: 'Estrela', weight: 9, payout: { 3: 15, 4: 70, 5: 350 } },
  { id: 'moeda', label: 'Moeda', weight: 7, payout: { 3: 30, 4: 150, 5: 700 } },
  { id: 'coroa', label: 'Coroa', weight: 5.5, payout: { 3: 60, 4: 300, 5: 1400 } },
  { id: 'diamante', label: 'Diamante', weight: 4, payout: { 3: 150, 4: 700, 5: 3500 } },
  { id: 'sete', label: 'Sete', weight: 3.5, payout: { 3: 200, 4: 1000, 5: 5500 } },
  { id: 'jackpot', label: 'Jackpot', weight: 3, payout: { 3: 300, 4: 1600, 5: 8500 } },
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
