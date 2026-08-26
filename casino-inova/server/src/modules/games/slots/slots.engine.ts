import { PAYLINES, SLOT_SYMBOLS, SlotSymbol } from './slots.config';

export interface WinningLine {
  payline: string;
  symbolId: string;
  win: number;
}

export interface SpinResult {
  /** 9 ids de símbolo, células 0-8 (ver slots.config.ts para o layout da grade). */
  grid: string[];
  winningLines: WinningLine[];
  totalWin: number;
}

function totalWeight(symbols: readonly SlotSymbol[] = SLOT_SYMBOLS): number {
  return symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
}

/**
 * Sorteia um símbolo respeitando o peso de cada um. Cada uma das 9 células da grade
 * usa a mesma distribuição — não há reels com peso diferente nesta v1 (ver
 * comentário em `spin`).
 */
export function drawSymbol(random: () => number = Math.random): SlotSymbol {
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
 * `random` é injetável só para os testes (mock determinístico) — em produção sempre
 * usa `Math.random`. Cada célula é sorteada de forma independente; um motor "de
 * verdade" usaria strips de reel com repetição controlada por coluna, mas o modelo
 * independente já é auditável e suficiente para a Fase 1.
 */
export function spin(bet: number, random: () => number = Math.random): SpinResult {
  const grid = Array.from({ length: 9 }, () => drawSymbol(random).id);

  const winningLines: WinningLine[] = [];
  for (const payline of PAYLINES) {
    const [a, b, c] = payline.cells;
    if (grid[a] === grid[b] && grid[b] === grid[c]) {
      const symbol = SLOT_SYMBOLS.find((item) => item.id === grid[a])!;
      winningLines.push({ payline: payline.name, symbolId: symbol.id, win: bet * symbol.payout3 });
    }
  }

  const totalWin = winningLines.reduce((sum, line) => sum + line.win, 0);
  return { grid, winningLines, totalWin };
}

/**
 * RTP teórico exato (não simulado) desta configuração, como fração de 1 (0.889 = 88.9%).
 * Válido porque cada payline paga só em trinca e cada célula é independente e
 * identicamente distribuída: P(trinca do símbolo X numa linha) = p(X)^3, e a esperança
 * total é a soma sobre todas as linhas e símbolos — linearidade da esperança vale
 * mesmo as linhas compartilhando células (a covariância entre linhas afeta a
 * variância dos resultados, não a média).
 */
export function theoreticalRtp(): number {
  const total = totalWeight();
  const evPerPayline = SLOT_SYMBOLS.reduce((sum, symbol) => {
    const probability = symbol.weight / total;
    return sum + probability ** 3 * symbol.payout3;
  }, 0);
  return evPerPayline * PAYLINES.length;
}
