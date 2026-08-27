import { resolveBets, rollUntilDecisive, theoreticalRtp } from './banca-francesa.engine';
import { BET_TYPES } from './banca-francesa.config';

/**
 *   npx ts-node src/modules/games/banca-francesa/verify-rtp.ts
 */
const ROUNDS = 500_000;
const BET = 100;

for (const betType of BET_TYPES) {
  let totalBet = 0;
  let totalReturned = 0;

  for (let i = 0; i < ROUNDS; i += 1) {
    const { outcome } = rollUntilDecisive();
    const [result] = resolveBets(outcome, [{ type: betType, amount: BET }]);
    totalBet += BET;
    totalReturned += result.totalReturn;
  }

  const theoretical = theoreticalRtp(betType) * 100;
  const simulated = (totalReturned / totalBet) * 100;
  console.log(`${betType.padEnd(8)} — RTP teórico: ${theoretical.toFixed(3)}% | RTP simulado (${ROUNDS.toLocaleString('pt-BR')} rodadas): ${simulated.toFixed(3)}%`);
}
