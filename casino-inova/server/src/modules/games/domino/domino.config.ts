/** Jogo de dominó "block" clássico (double-six): 28 peças, sem comprar do monte quando não tem jogada — só passa a vez. */
export interface Tile {
  a: number;
  b: number;
}

export function buildTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      tiles.push({ a, b });
    }
  }
  return tiles;
}

export const HAND_SIZE = 7;
export const MIN_BUY_IN = 100;
export const MAX_BUY_IN = 5000;
/** A partida inteira (até alguém bater ou o jogo travar) vale como uma aposta só, igual ao truco. */
export const MATCH_WIN_TOTAL_MULTIPLIER = 2;
