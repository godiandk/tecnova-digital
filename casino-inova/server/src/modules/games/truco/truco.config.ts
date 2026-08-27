/**
 * Baralho de truco: 40 cartas — as mesmas 4 naipes de sempre, mas sem os 8, 9 e 10.
 * `RANKS` já está na ordem de força do truco (mais fraca pra mais forte), não na
 * ordem numérica normal — é assim que "3" bate tudo e "4" perde de tudo (fora manilha).
 */
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type TrucoRank = (typeof RANKS)[number];

/** Ordem de força das manilhas entre si — a consagrada como "zap, copas, espadilha, ouros". */
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: TrucoRank;
  suit: Suit;
}

/**
 * Duas variantes de verdade, com regras diferentes (não é só um nome diferente):
 *
 * - `paulista` (padrão): a manilha muda a cada mão, definida pela "vira" (a carta
 *   virada depois de embaralhar — a manilha é o rank SEGUINTE ao dela). Mão começa
 *   valendo 1, escada 1 → 3 → 6 → 9 → 12.
 *
 * - `mineiro`: NÃO tem vira. As manilhas são sempre as mesmas quatro cartas fixas.
 *   Mão começa valendo 2, e a escada sobe de forma diferente.
 *
 * Fontes: blog.copag.com.br, blog.megajogos.com.br e jogosdorei.com.br (agosto/2026).
 */
export type TrucoVariant = 'paulista' | 'mineiro';

/**
 * Estilo da mesa:
 * - `sujo`: sinais pro parceiro são permitidos — no truco paulista eles são parte
 *   oficial do jogo, é o famoso "fazer careta" pra avisar que tem manilha.
 * - `limpo`: sinal é proibido; ganha quem tem cara de pau, não quem combina.
 *
 * Só faz diferença em mesa 2x2 (dupla), porque sinal é pro parceiro.
 */
export type TrucoStyle = 'sujo' | 'limpo';

/**
 * As quatro manilhas fixas do truco mineiro, da MAIS FRACA pra mais forte. Repare que
 * a ordem de naipe é a mesma do paulista (ouros < espadas < copas < paus) — o que muda
 * é que aqui o rank também é fixo por carta, em vez de sair da vira.
 */
export const MINEIRO_FIXED_MANILHAS: { card: Card; nickname: string }[] = [
  { card: { rank: '7', suit: 'ouros' }, nickname: 'mole' },
  { card: { rank: 'A', suit: 'espadas' }, nickname: 'espadilha' },
  { card: { rank: '7', suit: 'copas' }, nickname: 'copeta' },
  { card: { rank: '4', suit: 'paus' }, nickname: 'zap' },
];

export interface VariantRules {
  /** Se tem vira, a manilha é dinâmica; se não, usa MINEIRO_FIXED_MANILHAS. */
  hasVira: boolean;
  baseHandValue: number;
  handValueLadder: number[];
  raiseLabel: Record<number, string>;
  pointsToWinMatch: number;
  /** A partir de quantos pontos vale a regra da "mão de ferro" (ver truco.service.ts). */
  ironHandAt: number;
}

export const VARIANT_RULES: Record<TrucoVariant, VariantRules> = {
  /**
   * Escada paulista: correr do truco entrega 1 ponto, do seis entrega 3, do nove
   * entrega 6, do doze entrega 9 — sempre o degrau anterior.
   */
  paulista: {
    hasVira: true,
    baseHandValue: 1,
    handValueLadder: [1, 3, 6, 9, 12],
    raiseLabel: { 3: 'truco', 6: 'seis', 9: 'nove', 12: 'doze' },
    pointsToWinMatch: 12,
    ironHandAt: 11,
  },
  /**
   * Escada mineira: a mão já nasce valendo 2. ATENÇÃO — as fontes divergem no topo
   * da escada: blog.copag.com.br descreve 2 → 4 → 6 → 10 → 12 e
   * blog.megajogos.com.br descreve 2 → 4 → 6 → 12. As duas concordam no começo
   * (2, 4, 6) e no fim (12). Adotamos a versão mais granular (com o 10), que dá mais
   * espaço de blefe; como isto aqui é só dado, mudar pra outra é trocar esta linha.
   */
  mineiro: {
    hasVira: false,
    baseHandValue: 2,
    handValueLadder: [2, 4, 6, 10, 12],
    raiseLabel: { 4: 'truco', 6: 'seis', 10: 'dez', 12: 'doze' },
    pointsToWinMatch: 12,
    ironHandAt: 11,
  },
};

export function nextHandValue(variant: TrucoVariant, current: number): number | null {
  const ladder = VARIANT_RULES[variant].handValueLadder;
  const index = ladder.indexOf(current);
  if (index === -1 || index === ladder.length - 1) return null;
  return ladder[index + 1];
}

/**
 * Sinais que dá pra fazer pro parceiro numa mesa "suja". A ordem e os nomes batem com
 * os ícones de careta pedidos em docs/prompt-mesas-e-baralho.md (sinais-truco.png) —
 * o índice aqui é o índice da imagem na grade 3x3.
 */
export const TRUCO_SIGNALS = [
  { id: 'zap', label: 'Tenho o zap', gesture: 'Piscada de um olho', iconIndex: 0 },
  { id: 'copas', label: 'Tenho o 7 de copas', gesture: 'Morder o lábio', iconIndex: 1 },
  { id: 'espadilha', label: 'Tenho a espadilha', gesture: 'Levantar as sobrancelhas', iconIndex: 2 },
  { id: 'ourito', label: 'Tenho o 7 de ouros', gesture: 'Boca em bico', iconIndex: 3 },
  { id: 'duas-manilhas', label: 'Tenho duas manilhas', gesture: 'Língua de fora', iconIndex: 4 },
  { id: 'mao-boa', label: 'Mão boa', gesture: 'Cabeça de lado com sorriso', iconIndex: 5 },
  { id: 'mao-ruim', label: 'Mão ruim, corre', gesture: 'Ombros encolhidos', iconIndex: 6 },
  { id: 'pede-truco', label: 'Pede truco', gesture: 'Olhar pra cima', iconIndex: 7 },
  { id: 'nao-pede', label: 'Não pede', gesture: 'Balançar a cabeça em não', iconIndex: 8 },
] as const;

export type TrucoSignalId = (typeof TRUCO_SIGNALS)[number]['id'];

export const MIN_BUY_IN = 100;
export const MAX_BUY_IN = 5000;
/**
 * A partida inteira (até alguém chegar aos pontos da variante) vale como uma aposta
 * só, de valor fixo — é o jeito de encaixar o truco na mesma economia de fichas dos
 * outros jogos. Ganhar a partida paga o dobro do buy-in (aposta par).
 */
export const MATCH_WIN_TOTAL_MULTIPLIER = 2;
