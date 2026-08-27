import {
  BacBoBetType,
  DICE_PER_SIDE,
  FACES,
  SIDE_TOTAL_MULTIPLIER,
  TIE_PROFIT_ODDS,
  TIE_REFUND_MULTIPLIER,
} from './bac-bo.config';

export interface BacBoRoll {
  playerDice: number[];
  bankerDice: number[];
  playerTotal: number;
  bankerTotal: number;
  outcome: BacBoBetType;
}

export interface BacBoBet {
  type: BacBoBetType;
  amount: number;
}

export interface BacBoBetResult extends BacBoBet {
  won: boolean;
  totalReturn: number;
}

function rollPair(random: () => number): number[] {
  return Array.from({ length: DICE_PER_SIDE }, () => Math.floor(random() * FACES) + 1);
}

export function roll(random: () => number = Math.random): BacBoRoll {
  const playerDice = rollPair(random);
  const bankerDice = rollPair(random);
  const playerTotal = playerDice.reduce((sum, die) => sum + die, 0);
  const bankerTotal = bankerDice.reduce((sum, die) => sum + die, 0);
  const outcome: BacBoBetType =
    playerTotal > bankerTotal ? 'jogador' : bankerTotal > playerTotal ? 'banca' : 'empate';
  return { playerDice, bankerDice, playerTotal, bankerTotal, outcome };
}

export function resolveBets(result: BacBoRoll, bets: BacBoBet[]): BacBoBetResult[] {
  return bets.map((bet) => {
    if (bet.type === 'empate') {
      if (result.outcome !== 'empate') {
        return { ...bet, won: false, totalReturn: 0 };
      }
      const profitOdds = TIE_PROFIT_ODDS[result.playerTotal];
      return { ...bet, won: true, totalReturn: bet.amount * (profitOdds + 1) };
    }

    // Aposta em jogador/banca: no empate a rodada não decide, e a casa retém 10%.
    // Arredonda pra baixo porque ficha é sempre número inteiro — numa aposta de 55,
    // 90% daria 49,5. O arredondamento é sempre a favor da casa (é o padrão em mesa
    // real com comissão), e some totalmente em apostas múltiplas de 10.
    if (result.outcome === 'empate') {
      return { ...bet, won: false, totalReturn: Math.floor(bet.amount * TIE_REFUND_MULTIPLIER) };
    }

    const won = bet.type === result.outcome;
    return { ...bet, won, totalReturn: won ? bet.amount * SIDE_TOTAL_MULTIPLIER : 0 };
  });
}

/** Quantas das 36 combinações de 2 dados somam exatamente `total`. */
function waysForTotal(total: number): number {
  let ways = 0;
  for (let a = 1; a <= FACES; a += 1) {
    const b = total - a;
    if (b >= 1 && b <= FACES) ways += 1;
  }
  return ways;
}

/**
 * RTP exato por fórmula fechada. O espaço amostral é 36 x 36 = 1296 (cada lado tem
 * 36 combinações de 2 dados, independentes entre si).
 *
 * P(empate no total t) = (ways(t)/36)^2, e P(empate) = soma disso = 146/1296.
 * Por simetria, P(jogador vence) = P(banca vence) = (1296 - 146) / 2 / 1296.
 */
export function theoreticalRtp(betType: BacBoBetType): number {
  const TOTAL_COMBOS = 36 * 36;
  const totals = Object.keys(TIE_PROFIT_ODDS).map(Number);

  const tieCombos = totals.reduce((sum, total) => sum + waysForTotal(total) ** 2, 0);

  if (betType === 'empate') {
    const returned = totals.reduce(
      (sum, total) => sum + waysForTotal(total) ** 2 * (TIE_PROFIT_ODDS[total] + 1),
      0,
    );
    return returned / TOTAL_COMBOS;
  }

  const sideWinCombos = (TOTAL_COMBOS - tieCombos) / 2;
  const returned = sideWinCombos * SIDE_TOTAL_MULTIPLIER + tieCombos * TIE_REFUND_MULTIPLIER;
  return returned / TOTAL_COMBOS;
}
