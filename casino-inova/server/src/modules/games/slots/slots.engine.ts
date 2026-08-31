import { CELLS, MIN_MATCH, PAYLINES, REELS, SLOT_SYMBOLS, SlotSymbol } from './slots.config';
import { fracao } from '../shared/rng';

export interface WinningLine {
  payline: string;
  symbolId: string;
  /** Quantos símbolos iguais seguidos saíram, contando do rolo 1. Sempre >= MIN_MATCH. */
  matched: number;
  /** As células que formaram a combinação — a tela acende exatamente estas. */
  cells: number[];
  win: number;
}

export interface SpinResult {
  /** 15 ids de símbolo, células 0-14 (ver slots.config.ts para o layout da grade). */
  grid: string[];
  winningLines: WinningLine[];
  totalWin: number;
}

function totalWeight(symbols: readonly SlotSymbol[] = SLOT_SYMBOLS): number {
  return symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
}

/**
 * Sorteia um símbolo respeitando o peso de cada um. Todas as células usam a mesma
 * distribuição — não há strip de reel com peso próprio por coluna (ver `spin`).
 */
export function drawSymbol(random: () => number = fracao): SlotSymbol {
  const total = totalWeight();
  let roll = random() * total;
  for (const symbol of SLOT_SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) {
      return symbol;
    }
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

/**
 * Conta quantos símbolos iguais ao do primeiro rolo aparecem seguidos nesta linha.
 * É a regra padrão de slot de vídeo: a combinação começa OBRIGATORIAMENTE no rolo 1 e
 * anda pra direita até quebrar. Três iguais nos rolos 2-3-4 não pagam nada.
 */
function matchFromLeft(grid: string[], cells: readonly number[]): number {
  const first = grid[cells[0]];
  let matched = 1;
  while (matched < cells.length && grid[cells[matched]] === first) {
    matched += 1;
  }
  return matched;
}

/**
 * `random` é injetável só para os testes (mock determinístico) — em produção sempre usa
 * o sorteio seguro de shared/rng.ts. Cada célula é sorteada de forma independente; um motor "de verdade"
 * usaria strips de reel com repetição controlada por coluna, mas o modelo independente
 * já é auditável, e é o que torna o RTP calculável em fórmula fechada abaixo.
 */
export function spin(bet: number, random: () => number = fracao): SpinResult {
  const grid = Array.from({ length: CELLS }, () => drawSymbol(random).id);

  const winningLines: WinningLine[] = [];
  for (const payline of PAYLINES) {
    const matched = matchFromLeft(grid, payline.cells);
    if (matched < MIN_MATCH) continue;

    const symbolId = grid[payline.cells[0]];
    const symbol = SLOT_SYMBOLS.find((item) => item.id === symbolId)!;
    const multiplier = symbol.payout[matched as 3 | 4 | 5];
    winningLines.push({
      payline: payline.name,
      symbolId,
      matched,
      cells: payline.cells.slice(0, matched),
      win: bet * multiplier,
    });
  }

  const totalWin = winningLines.reduce((sum, line) => sum + line.win, 0);
  return { grid, winningLines, totalWin };
}

/**
 * RTP teórico exato (não simulado) desta configuração, como fração de 1 (0.892 = 89.2%).
 *
 * Vale porque cada célula é independente e igualmente distribuída, e porque a
 * combinação só conta a partir do rolo 1. Para um símbolo de probabilidade p, numa
 * linha de 5 rolos:
 *
 *   P(exatamente 3) = p³(1-p)   — os três primeiros batem e o quarto quebra
 *   P(exatamente 4) = p⁴(1-p)
 *   P(exatamente 5) = p⁵        — não tem o que quebrar depois
 *
 * A esperança total é a soma sobre todos os símbolos e todas as linhas. A linearidade
 * da esperança vale mesmo com as linhas compartilhando células (a covariância entre
 * linhas mexe na variância dos resultados, não na média).
 */
export function theoreticalRtp(): number {
  const total = totalWeight();
  const evPerPayline = SLOT_SYMBOLS.reduce((sum, symbol) => {
    const p = symbol.weight / total;
    const exactly3 = p ** 3 * (1 - p) * symbol.payout[3];
    const exactly4 = p ** 4 * (1 - p) * symbol.payout[4];
    const exactly5 = p ** 5 * symbol.payout[5];
    return sum + exactly3 + exactly4 + exactly5;
  }, 0);
  return evPerPayline * PAYLINES.length;
}

/** Só pra tela conseguir desenhar a grade sem repetir a conta. */
export function cellsOfReel(reel: number): number[] {
  return Array.from({ length: CELLS / REELS }, (_, row) => row * REELS + reel);
}
