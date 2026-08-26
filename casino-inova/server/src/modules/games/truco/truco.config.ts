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
export const TRUCO_HAND_VALUE = 3;
export const BASE_HAND_VALUE = 1;

export const MIN_BUY_IN = 100;
export const MAX_BUY_IN = 5000;
/**
 * A partida inteira (até alguém chegar a 12 pontos) vale como uma aposta só, de valor
 * fixo — é o jeito de encaixar o truco na mesma economia de fichas dos outros jogos.
 * Ganhar a partida paga o dobro do buy-in (aposta par).
 */
export const MATCH_WIN_TOTAL_MULTIPLIER = 2;
