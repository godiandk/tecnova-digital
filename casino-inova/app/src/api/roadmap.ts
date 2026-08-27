/**
 * Formato do placar de histórico devolvido pelo servidor. As cinco estradas de uma
 * mesa de bacará/bac bo — ver server/src/modules/roadmap/roadmap.service.ts.
 */
export type RoadOutcome = 'banca' | 'jogador' | 'empate';
export type DerivedMark = 'vermelho' | 'azul';

export interface BeadCell {
  outcome: RoadOutcome;
  bankerPair?: boolean;
  playerPair?: boolean;
}

export interface BigRoadCell {
  outcome: 'banca' | 'jogador';
  /** Quantos empates aconteceram em cima desta célula (desenha o risco verde). */
  ties: number;
}

export interface Roadmap {
  beadPlate: BeadCell[][];
  bigRoad: BigRoadCell[][];
  /** Já com a "cauda do dragão" resolvida: onde cada célula fica na grade. */
  bigRoadLayout: { column: number; row: number; cell: BigRoadCell }[];
  bigEyeBoy: DerivedMark[][];
  smallRoad: DerivedMark[][];
  cockroachPig: DerivedMark[][];
  totals: { banca: number; jogador: number; empate: number; total: number };
}
