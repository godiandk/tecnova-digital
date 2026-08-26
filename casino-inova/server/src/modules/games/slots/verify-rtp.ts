import { spin, theoreticalRtp } from './slots.engine';

/**
 * Confere o RTP teórico (calculado por fórmula) contra uma simulação de Monte Carlo —
 * rodar depois de qualquer mudança em slots.config.ts, antes de assumir que o RTP
 * novo é o que você pensa que é.
 *
 *   npx ts-node src/modules/games/slots/verify-rtp.ts
 */
const SPINS = 500_000;
const BET = 100;

let totalBet = 0;
let totalReturned = 0;

for (let i = 0; i < SPINS; i += 1) {
  const result = spin(BET);
  totalBet += BET;
  totalReturned += result.totalWin;
}

const simulatedRtp = totalReturned / totalBet;
const theoretical = theoreticalRtp();

console.log(`RTP teórico (fórmula exata): ${(theoretical * 100).toFixed(2)}%`);
console.log(`RTP simulado (${SPINS.toLocaleString('pt-BR')} giros): ${(simulatedRtp * 100).toFixed(2)}%`);
console.log(`Diferença: ${((simulatedRtp - theoretical) * 100).toFixed(3)} pontos percentuais`);
