import { DICE_COUNT, FACES, TOTAL_MULTIPLIER_BY_MATCHES } from './banca-francesa.config';

export interface NumberBet {
  number: number;
  amount: number;
}

export interface BetResult extends NumberBet {
  matches: number;
  totalReturn: number;
}

export function rollDice(random: () => number = Math.random): number[] {
  return Array.from({ length: DICE_COUNT }, () => Math.floor(random() * FACES) + 1);
}

export function resolveBets(dice: number[], bets: NumberBet[]): BetResult[] {
  return bets.map((bet) => {
    const matches = dice.filter((die) => die === bet.number).length;
    const totalReturn = bet.amount * TOTAL_MULTIPLIER_BY_MATCHES[matches];
    return { ...bet, matches, totalReturn };
  });
}

/**
 * RTP exato por fórmula fechada (igual roleta) — não depende de estratégia, porque
 * apostar em mais de um número ao mesmo tempo não muda o retorno esperado por ficha
 * apostada, só reduz a variância (linearidade da esperança).
 * P(0 dados bateram) = (5/6)^3, P(1) = C(3,1)(1/6)(5/6)^2, P(2) = C(3,2)(1/6)^2(5/6), P(3) = (1/6)^3.
 * EV = P(1)*2 + P(2)*3 + P(3)*4 = 199/216 ≈ 92,13% — é o mesmo número conhecido do
 * "Chuck-a-Luck"/"Birdcage", o jogo internacional equivalente à banca francesa.
 */
export function theoreticalRtp(): number {
  const p = (matches: number): number => {
    const combinations = [1, 3, 3, 1][matches]; // C(3, matches)
    return (combinations * (1 / FACES) ** matches * (1 - 1 / FACES) ** (DICE_COUNT - matches));
  };
  return [1, 2, 3].reduce((sum, matches) => sum + p(matches) * TOTAL_MULTIPLIER_BY_MATCHES[matches], 0);
}
