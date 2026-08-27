import { Injectable } from '@nestjs/common';

/**
 * Placar de histórico ("roadmap") — o painel que toda mesa de bacará, bac bo, banca
 * francesa e roleta tem do lado, mostrando o resultado das últimas rodadas.
 *
 * São cinco estradas. Duas mostram o que de fato aconteceu (Bead Plate e Big Road);
 * as outras três são "derivadas": elas não dizem quem ganhou, dizem se a mesa está
 * repetindo (vermelho) ou picando/alternando (azul). Regras de construção conferidas
 * em baccarat.net e wgm8.com (agosto/2026).
 *
 * AVISO HONESTO, e que o app repete pro jogador no tutorial: ler o placar não muda a
 * chance de nada. Cada rodada é independente — o dado e a carta não têm memória. O
 * placar existe porque é parte da experiência de mesa real e porque o jogador quer
 * ver o histórico, não porque prevê resultado. Em nenhum lugar deste projeto a gente
 * sugere que dá pra prever a próxima rodada a partir do passado.
 */

/** Vencedor de uma rodada, no vocabulário genérico das cinco estradas. */
export type RoadOutcome = 'banca' | 'jogador' | 'empate';

export interface RoundRecord {
  outcome: RoadOutcome;
  /** Par natural, quando o jogo tiver (bacará tem, bac bo não) — vira o pontinho no canto. */
  bankerPair?: boolean;
  playerPair?: boolean;
}

export interface BeadCell {
  outcome: RoadOutcome;
  bankerPair?: boolean;
  playerPair?: boolean;
}

export interface BigRoadCell {
  /** Só 'banca' ou 'jogador' — empate não abre célula própria, marca a anterior. */
  outcome: 'banca' | 'jogador';
  /** Quantos empates aconteceram em cima desta célula (desenha o risco verde). */
  ties: number;
  bankerPair?: boolean;
  playerPair?: boolean;
}

/** Vermelho = mesa repetindo o padrão. Azul = mesa picando. Não é banca/jogador. */
export type DerivedMark = 'vermelho' | 'azul';

export const BEAD_ROWS = 6;
export const BIG_ROAD_ROWS = 6;

@Injectable()
export class RoadmapService {
  /**
   * Bead Plate: o mais simples — uma conta por rodada, na ordem, preenchendo de cima
   * pra baixo e pulando pra coluna seguinte ao encher as 6 linhas. Empate tem conta
   * própria aqui (diferente do Big Road).
   */
  buildBeadPlate(rounds: RoundRecord[]): BeadCell[][] {
    const columns: BeadCell[][] = [];
    rounds.forEach((round, index) => {
      const columnIndex = Math.floor(index / BEAD_ROWS);
      if (!columns[columnIndex]) columns[columnIndex] = [];
      columns[columnIndex].push({
        outcome: round.outcome,
        bankerPair: round.bankerPair,
        playerPair: round.playerPair,
      });
    });
    return columns;
  }

  /**
   * Big Road: a estrada principal. Cada coluna é uma sequência do mesmo vencedor;
   * quando o vencedor muda, abre coluna nova. Empate NÃO abre célula — ele risca a
   * última célula existente (por isso `ties` é um contador).
   *
   * A "cauda do dragão": se uma sequência passa de 6 (a altura da grade), ela não
   * continua descendo — ela vira à direita e segue na última linha. É por isso que a
   * posição de cada célula é calculada aqui em vez de ser só o índice na coluna.
   */
  buildBigRoad(rounds: RoundRecord[]): BigRoadCell[][] {
    const columns: BigRoadCell[][] = [];

    for (const round of rounds) {
      if (round.outcome === 'empate') {
        const lastColumn = columns[columns.length - 1];
        const lastCell = lastColumn?.[lastColumn.length - 1];
        if (lastCell) {
          lastCell.ties += 1;
        }
        // Empate antes de qualquer resultado decisivo não tem o que marcar — ignora.
        continue;
      }

      const cell: BigRoadCell = {
        outcome: round.outcome,
        ties: 0,
        bankerPair: round.bankerPair,
        playerPair: round.playerPair,
      };

      const lastColumn = columns[columns.length - 1];
      if (!lastColumn || lastColumn[0].outcome !== round.outcome) {
        columns.push([cell]);
      } else {
        lastColumn.push(cell);
      }
    }

    return columns;
  }

  /**
   * Posição visual de cada célula do Big Road, já com a cauda do dragão resolvida.
   * Enquanto a coluna cabe nas 6 linhas, desce normal. Ao estourar, a sequência dobra
   * à direita e caminha pela linha 6 (índice 5), uma coluna por rodada.
   */
  layoutBigRoad(columns: BigRoadCell[][]): { column: number; row: number; cell: BigRoadCell }[] {
    const placed: { column: number; row: number; cell: BigRoadCell }[] = [];

    columns.forEach((column, columnIndex) => {
      column.forEach((cell, depth) => {
        if (depth < BIG_ROAD_ROWS) {
          placed.push({ column: columnIndex, row: depth, cell });
        } else {
          // Estourou: anda pra direita na última linha, um passo por rodada extra.
          placed.push({ column: columnIndex + (depth - BIG_ROAD_ROWS) + 1, row: BIG_ROAD_ROWS - 1, cell });
        }
      });
    });

    return placed;
  }

  /**
   * As três estradas derivadas seguem a MESMA regra, mudando só o quanto olham pra
   * trás no Big Road:
   * - Big Eye Boy: recuo 1, começa depois da 1ª entrada da 2ª coluna
   * - Small Road: recuo 2, começa depois da 1ª entrada da 3ª coluna
   * - Cockroach Pig: recuo 3, começa depois da 1ª entrada da 4ª coluna
   *
   * A regra, para cada entrada nova do Big Road:
   * - Se ela ABRIU uma coluna nova: compara o comprimento das duas colunas anteriores
   *   (a de trás e a de `recuo` a mais). Comprimentos iguais → vermelho, diferentes → azul.
   * - Se ela CONTINUOU a coluna: olha a coluna `recuo` à esquerda e pergunta se ela já
   *   tinha altura suficiente pra acompanhar. Tinha → vermelho, não tinha → azul.
   */
  private buildDerivedRoad(columns: BigRoadCell[][], lookback: number): DerivedMark[] {
    const marks: DerivedMark[] = [];

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      for (let depth = 0; depth < columns[columnIndex].length; depth += 1) {
        // A estrada derivada só começa depois da 1ª entrada da coluna (lookback + 1).
        const isStart = columnIndex === lookback && depth === 0;
        if (columnIndex < lookback || isStart) continue;

        let mark: DerivedMark;

        if (depth === 0) {
          const previous = columns[columnIndex - 1];
          const older = columns[columnIndex - 1 - lookback];
          if (!previous || !older) continue;
          mark = previous.length === older.length ? 'vermelho' : 'azul';
        } else {
          const compared = columns[columnIndex - lookback];
          if (!compared) continue;
          // A coluna comparada "acompanha" se já tinha pelo menos esta profundidade.
          mark = compared.length >= depth ? 'vermelho' : 'azul';
        }

        marks.push(mark);
      }
    }

    return marks;
  }

  buildBigEyeBoy(columns: BigRoadCell[][]): DerivedMark[] {
    return this.buildDerivedRoad(columns, 1);
  }

  buildSmallRoad(columns: BigRoadCell[][]): DerivedMark[] {
    return this.buildDerivedRoad(columns, 2);
  }

  buildCockroachPig(columns: BigRoadCell[][]): DerivedMark[] {
    return this.buildDerivedRoad(columns, 3);
  }

  /** Quebra uma lista linear de marcas em colunas de 6, do jeito que o painel desenha. */
  private toColumns<T>(marks: T[], rows = BEAD_ROWS): T[][] {
    const columns: T[][] = [];
    marks.forEach((mark, index) => {
      const columnIndex = Math.floor(index / rows);
      if (!columns[columnIndex]) columns[columnIndex] = [];
      columns[columnIndex].push(mark);
    });
    return columns;
  }

  /** Tudo que o painel precisa pra desenhar, numa chamada só. */
  build(rounds: RoundRecord[]) {
    const bigRoadColumns = this.buildBigRoad(rounds);

    return {
      beadPlate: this.buildBeadPlate(rounds),
      bigRoad: bigRoadColumns,
      bigRoadLayout: this.layoutBigRoad(bigRoadColumns),
      bigEyeBoy: this.toColumns(this.buildBigEyeBoy(bigRoadColumns)),
      smallRoad: this.toColumns(this.buildSmallRoad(bigRoadColumns)),
      cockroachPig: this.toColumns(this.buildCockroachPig(bigRoadColumns)),
      totals: {
        banca: rounds.filter((round) => round.outcome === 'banca').length,
        jogador: rounds.filter((round) => round.outcome === 'jogador').length,
        empate: rounds.filter((round) => round.outcome === 'empate').length,
        total: rounds.length,
      },
    };
  }
}
