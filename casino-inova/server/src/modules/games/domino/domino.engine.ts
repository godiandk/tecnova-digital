import { Tile } from './domino.config';

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function tileMatches(tile: Tile, end: number): boolean {
  return tile.a === end || tile.b === end;
}

export function otherEnd(tile: Tile, matchedEnd: number): number {
  return tile.a === matchedEnd ? tile.b : tile.a;
}

export function canPlay(hand: Tile[], leftEnd: number | null, rightEnd: number | null): boolean {
  if (leftEnd === null || rightEnd === null) return hand.length > 0;
  return hand.some((tile) => tileMatches(tile, leftEnd) || tileMatches(tile, rightEnd));
}

export function tileSum(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

export type BoardEnd = 'esquerda' | 'direita';

interface BotMove {
  tile: Tile;
  end: BoardEnd;
}

/** Bot simples: entre as jogadas possíveis, prioriza livrar da mão a peça de maior soma de pontos — sem estratégia de bloqueio. */
export function chooseBotMove(hand: Tile[], leftEnd: number, rightEnd: number): BotMove | null {
  const candidates: (BotMove & { weight: number })[] = [];
  for (const tile of hand) {
    if (tileMatches(tile, leftEnd)) candidates.push({ tile, end: 'esquerda', weight: tile.a + tile.b });
    if (tileMatches(tile, rightEnd)) candidates.push({ tile, end: 'direita', weight: tile.a + tile.b });
  }
  if (candidates.length === 0) return null;
  candidates.sort((x, y) => y.weight - x.weight);
  return { tile: candidates[0].tile, end: candidates[0].end };
}
