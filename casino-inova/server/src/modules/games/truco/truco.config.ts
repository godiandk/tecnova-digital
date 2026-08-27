/**
 * Baralho de truco: 40 cartas — as mesmas 4 naipes de sempre, mas sem os 8, 9 e 10.
 * `RANKS` já está na ordem de força do truco (mais fraca pra mais forte), não na
 * ordem numérica normal — é assim que "3" bate tudo e "4" perde de tudo (fora manilha).
 */
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type TrucoRank = (typeof RANKS)[number];

/** Ordem de força das manilhas entre si — a mesma consagrada popularmente como "zap, copas, espadilha, ouros". */
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: TrucoRank;
  suit: Suit;
}

export const POINTS_TO_WIN_MATCH = 12;
export const BASE_HAND_VALUE = 1;

/**
 * Escada de aumento do truco: a mão começa valendo 1 e cada pedido sobe um degrau —
 * "truco" (3), "seis", "nove" e "doze". Quem aceita joga pelo novo valor; quem corre
 * entrega ao adversário o valor do degrau ANTERIOR (correr do truco dá 1 ponto, do
 * seis dá 3, do nove dá 6, do doze dá 9). Só o lado que NÃO pediu por último pode
 * subir o próximo degrau — ninguém aumenta o próprio pedido.
 */
export const HAND_VALUE_LADDER = [1, 3, 6, 9, 12] as const;

/** Nome de cada pedido, na mesma ordem dos degraus a partir do segundo. */
export const RAISE_LABEL: Record<number, string> = {
  3: 'truco',
  6: 'seis',
  9: 'nove',
  12: 'doze',
};

export function nextHandValue(current: number): number | null {
  const index = HAND_VALUE_LADDER.indexOf(current as (typeof HAND_VALUE_LADDER)[number]);
  if (index === -1 || index === HAND_VALUE_LADDER.length - 1) return null;
  return HAND_VALUE_LADDER[index + 1];
}

export const MIN_BUY_IN = 100;
export const MAX_BUY_IN = 5000;
/**
 * A partida inteira (até alguém chegar a 12 pontos) vale como uma aposta só, de valor
 * fixo — é o jeito de encaixar o truco na mesma economia de fichas dos outros jogos.
 * Ganhar a partida paga o dobro do buy-in (aposta par).
 */
export const MATCH_WIN_TOTAL_MULTIPLIER = 2;
