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

/**
 * Quem abre a partida, e com qual peça.
 *
 * A regra do dominó: abre quem tem a MAIOR DUPLA, e é obrigado a abrir com ela. Se
 * ninguém tem dupla, abre quem tem a peça de maior soma. Antes o jogador abria sempre,
 * com a peça que quisesse — e abrir é vantagem (dita o ritmo e já tira uma peça da mão),
 * então dar essa vantagem sempre pro mesmo lado não era só regra faltando, era o jogo
 * torto pra um lado.
 *
 * `maos` vem na ordem dos jogadores; devolve o índice de quem abre e a peça.
 */
export function quemAbre(maos: Tile[][]): { indice: number; peca: Tile } {
  let melhorIndice = 0;
  let melhorPeca: Tile | null = null;
  let melhorNota = -1;

  maos.forEach((mao, indice) => {
    for (const peca of mao) {
      const dupla = peca.a === peca.b;
      /*
       * Qualquer dupla ganha de qualquer peça comum, então a nota da dupla começa acima
       * do teto das comuns (6+6=12). Entre duplas vale a maior; entre comuns, a de maior
       * soma.
       */
      const nota = dupla ? 100 + peca.a : peca.a + peca.b;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhorPeca = peca;
        melhorIndice = indice;
      }
    }
  });

  return { indice: melhorIndice, peca: melhorPeca! };
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
