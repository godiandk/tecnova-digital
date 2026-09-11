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
 *    distribuição é menos uniforme. Resultado: 20% de giros com prêmio, um em 5.
 * 2. PRÊMIOS DE CIMA ALCANÇÁVEIS. O Jackpot subiu de 0,5% pra 3% de probabilidade, e cinco
 *    Jackpots numa linha passaram de uma vez a cada 320 bilhões de giros pra uma a cada
 *    7,6 milhões. Continua raro — é um jackpot — mas agora existe.
 * 3. ESCADA DE PRÊMIOS REAL. Cada símbolo contribui entre 4,9 e 19,7 pontos de RTP, em
 *    vez de um contribuir 25 e outro 0,013. Repartição: 59% nos quatro comuns, 18% nos
 *    três do meio, 23% nos dois de cima — e agora os prêmios grandes pesam de verdade.
 *
 * 4. MULTIPLICADOR INTEIRO, SEMPRE. A primeira calibração usou 0,35 e 1,8 pra segurar o
 *    símbolo mais comum, e a matemática ficava certa — mas a mesa quebrava: numa aposta
 *    de 50, um prêmio de 0,35 vale 17,5 fichas, e a carteira recusa fração de ficha (é a
 *    regra que impede margem escondida em arredondamento). A conferência de ponta a
 *    ponta pegou, com 400 na cara do jogador. Aqui todos os 27 multiplicadores são
 *    inteiros, e o problema não pode voltar.
 *
 * 5. NENHUM PRÊMIO ABAIXO DA APOSTA. Como o menor multiplicador é 1, o pior "ganho"
 *    devolve exatamente o que foi apostado. Isso caiu do colo junto com os inteiros, e é
 *    melhor do que parece: todo slot comercial paga fração da aposta o tempo todo e
 *    comemora como vitória — que é derrota disfarçada de vitória, a coisa que este
 *    projeto decidiu não fazer. Aqui, se acendeu, no mínimo empatou.
 *
 * RTP: 95,9922% — margem da casa de 4,01%. O número é exato e sai desta tabela por
 * fórmula fechada (`theoreticalRtp`), conferido contra a distribuição exata
 * (`tools/analisa-slot.py`) e contra cinco milhões de giros simulados em `verify-rtp.ts`,
 * que REPROVA se sair da faixa.
 */
export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  { id: 'ferradura', label: 'Ferradura', weight: 60, payout: { 3: 1, 4: 2, 5: 3 } },
  { id: 'sino', label: 'Sino', weight: 44, payout: { 3: 2, 4: 5, 5: 15 } },
  { id: 'barras', label: 'Barras', weight: 28, payout: { 3: 4, 4: 20, 5: 100 } },
  { id: 'estrela', label: 'Estrela', weight: 20, payout: { 3: 10, 4: 50, 5: 250 } },
  { id: 'moeda', label: 'Moeda', weight: 14, payout: { 3: 25, 4: 125, 5: 600 } },
  { id: 'coroa', label: 'Coroa', weight: 10, payout: { 3: 60, 4: 300, 5: 1500 } },
  { id: 'diamante', label: 'Diamante', weight: 8, payout: { 3: 150, 4: 750, 5: 3500 } },
  { id: 'sete', label: 'Sete', weight: 7, payout: { 3: 400, 4: 2000, 5: 10000 } },
  { id: 'jackpot', label: 'Jackpot', weight: 6, payout: { 3: 700, 4: 3500, 5: 16000 } },
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

/**
 * O MAIOR RETORNO QUE UM GIRO PODE PAGAR, em múltiplos da aposta.
 *
 * Ele é CALCULADO da tabela, e não digitado: quem mexer num pagamento não precisa
 * lembrar de vir aqui, e o número nunca fica desatualizado em relação à mesa. A conta é
 * a pior hipótese honesta — a grade inteira sai no símbolo mais caro, e as cinco linhas
 * pagam cinco de uma vez.
 *
 * Serve pra recusar, ANTES de cobrar, uma aposta cujo prêmio máximo não caberia na conta
 * exata de fichas. Ver `comum/teto-de-fichas.ts`.
 */
export const MAIOR_MULTIPLICADOR =
  PAYLINES.length * Math.max(...SLOT_SYMBOLS.map((s) => s.payout[5]));
