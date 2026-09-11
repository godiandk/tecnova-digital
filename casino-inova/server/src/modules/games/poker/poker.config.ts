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

export const MAX_RAISES_PER_STREET = 3;

/**
 * AS APOSTAS SAEM DO BUY-IN, e não de dois números fixos no arquivo.
 *
 * Eram `SMALL_BLIND = 10` e `BIG_BLIND = 20`, iguais pra todo mundo, com buy-in travado em
 * 500 a 5.000. Quem tem cinco quatrilhões sentava numa mesa de blind 10 — uma mão inteira
 * de pôquer valendo menos que um arredondamento. A mesa existia e não significava nada.
 *
 * A PROPORÇÃO É A DE ANTES: no buy-in mínimo de então (500 fichas) o big blind era 20, ou
 * seja, um vinte e cinco avos. Mantida, o formato do jogo não muda — muda só a escala. Um
 * stack de 25 big blinds é curto de propósito: é o que faz uma mão heads-up de limit
 * hold'em terminar em vez de andar de lado.
 *
 * O PISO DE 2 existe porque ficha não se parte: com big blind 1, o small blind seria meia
 * ficha. Ele só morde em entradas minúsculas, abaixo de 50 fichas, que a faixa de entrada
 * do Bronze já não permite.
 */
export function apostasDaMesa(buyIn: number): ApostasDaMesa {
  const bigBlind = Math.max(2, 2 * Math.round(buyIn / 50));
  return {
    smallBlind: bigBlind / 2,
    bigBlind,
    /* Limit hold'em: aposta pequena nas duas primeiras ruas, dobrada nas duas últimas. */
    smallBet: bigBlind,
    bigBet: bigBlind * 2,
  };
}

export interface ApostasDaMesa {
  smallBlind: number;
  bigBlind: number;
  smallBet: number;
  bigBet: number;
}

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
