/**
 * Texas Hold'em heads-up (1 contra 1, você contra o bot), formato "limit" — cada
 * aposta/aumento tem um tamanho fixo por rua, em vez de qualquer valor (no-limit).
 * É uma simplificação real e nomeada (limit hold'em é uma variante de poker de
 * verdade, não uma invenção) que evita precisar de um campo de "quanto apostar" na
 * interface. Sem side pots — heads-up só tem 2 jogadores, então "all-in" apenas
 * força o resto da mão a correr sem mais apostas.
 */
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Suit = (typeof SUITS)[number];

/** 2 a 14 — Valete=11, Dama=12, Rei=13, Ás=14 (o Ás também conta como 1 na sequência A-2-3-4-5). */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const SMALL_BET = BIG_BLIND;
export const BIG_BET = BIG_BLIND * 2;
export const MAX_RAISES_PER_STREET = 3;

export const MIN_BUY_IN = 500;
export const MAX_BUY_IN = 5000;

export const HAND_CATEGORY_LABEL = [
  'Carta alta',
  'Par',
  'Dois pares',
  'Trinca',
  'Sequência',
  'Flush',
  'Full house',
  'Quadra',
  'Straight flush',
] as const;
