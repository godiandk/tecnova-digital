import { resolveBets, roll, theoreticalRtp } from './bac-bo.engine';
import { BacBoBetType } from './bac-bo.config';

/**
 *   npx ts-node src/modules/games/bac-bo/verify-rtp.ts
 *
 * Além de simular, faz a conta fechada por enumeração de TODAS as 1296 combinações,
 * pra conferir a fórmula contra a referência pública (Wizard of Odds): casa de 1,13%
 * em jogador/banca (RTP 98,87%) e 4,48% no empate (RTP 95,52%).
 */
const ROUNDS = 1_000_000;
const BET = 100;
const TYPES: BacBoBetType[] = ['jogador', 'banca', 'empate'];

// --- Enumeração exata: todos os pares de dados dos dois lados ---
const exact: Record<string, { staked: number; returned: number }> = {
  jogador: { staked: 0, returned: 0 },
  banca: { staked: 0, returned: 0 },
  empate: { staked: 0, returned: 0 },
};

for (let p1 = 1; p1 <= 6; p1 += 1)
  for (let p2 = 1; p2 <= 6; p2 += 1)
    for (let b1 = 1; b1 <= 6; b1 += 1)
      for (let b2 = 1; b2 <= 6; b2 += 1) {
        const playerTotal = p1 + p2;
        const bankerTotal = b1 + b2;
        const result = {
          playerDice: [p1, p2],
          bankerDice: [b1, b2],
          playerTotal,
          bankerTotal,
          outcome: (playerTotal > bankerTotal ? 'jogador' : bankerTotal > playerTotal ? 'banca' : 'empate') as BacBoBetType,
        };
        for (const type of TYPES) {
          const [res] = resolveBets(result, [{ type, amount: BET }]);
          exact[type].staked += BET;
          exact[type].returned += res.totalReturn;
        }
      }

console.log('=== Conta exata (todas as 1296 combinações) ===');
for (const type of TYPES) {
  const enumerated = (exact[type].returned / exact[type].staked) * 100;
  const formula = theoreticalRtp(type) * 100;
  const match = Math.abs(enumerated - formula) < 1e-9 ? 'OK' : 'DIVERGE!';
  console.log(
    `${type.padEnd(8)} — fórmula: ${formula.toFixed(4)}% | enumeração: ${enumerated.toFixed(4)}% | casa: ${(100 - formula).toFixed(2)}% [${match}]`,
  );
}

console.log('\n=== Simulação ===');
for (const type of TYPES) {
  let staked = 0;
  let returned = 0;
  for (let i = 0; i < ROUNDS; i += 1) {
    const [res] = resolveBets(roll(), [{ type, amount: BET }]);
    staked += BET;
    returned += res.totalReturn;
  }
  console.log(`${type.padEnd(8)} — RTP simulado (${ROUNDS.toLocaleString('pt-BR')} rodadas): ${((returned / staked) * 100).toFixed(3)}%`);
}

console.log('\nReferência pública (Wizard of Odds): jogador/banca 98,87% (casa 1,13%), empate 95,52% (casa 4,48%).');
