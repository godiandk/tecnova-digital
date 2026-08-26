import { resolveBets, rollDice, theoreticalRtp } from './banca-francesa.engine';

/**
 *   npx ts-node src/modules/games/banca-francesa/verify-rtp.ts
 */
const ROUNDS = 500_000;
const BET = 100;

let totalBet = 0;
let totalReturned = 0;

for (let i = 0; i < ROUNDS; i += 1) {
  const dice = rollDice();
  const [result] = resolveBets(dice, [{ number: 4, amount: BET }]);
  totalBet += BET;
  totalReturned += result.totalReturn;
}

console.log(`RTP teórico (fórmula exata): ${(theoreticalRtp() * 100).toFixed(2)}%`);
console.log(`RTP simulado (${ROUNDS.toLocaleString('pt-BR')} rodadas, sempre no número 4): ${((totalReturned / totalBet) * 100).toFixed(2)}%`);
