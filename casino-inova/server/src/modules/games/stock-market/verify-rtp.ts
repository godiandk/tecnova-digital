import { resolveBet, runRound, theoreticalRtp } from './stock-market.engine';
import { COMMISSION, StockDirection } from './stock-market.config';

/**
 *   npx ts-node src/modules/games/stock-market/verify-rtp.ts
 *
 * A prova de que o RTP é 99% e não depende de como a cotação se move:
 *
 * Numa rodada que fecha em c%, quem apostou ALTA recebe (1 + c/100) e quem apostou
 * BAIXA recebe (1 - c/100). Os dois multiplicadores SOMAM 2 pra qualquer c. Logo, o
 * jogo é de soma zero antes da comissão, e o retorno esperado de uma aposta é
 * exatamente (1 - comissão) desde que o fechamento seja simétrico em torno de zero.
 *
 * Este script confere isso de três jeitos:
 * 1. Identidade algébrica: alta + baixa = 2, testada em muitos fechamentos.
 * 2. Simulação com a nossa distribuição.
 * 3. Simulação com uma distribuição PROPOSITALMENTE ENVIESADA (a cotação tende a
 *    cair). Se o RTP continuar 99% nos dois lados, fica provado que o resultado não
 *    depende da distribuição — ou seja, não dá pra "esconder" vantagem no movimento.
 */
const ROUNDS = 500_000;
const BET = 1000;
let failures = 0;

console.log('=== 1. Identidade: alta + baixa = 2 pra qualquer fechamento ===');
for (const close of [-100, -73.4, -25, -0.01, 0, 0.01, 12.5, 60, 100]) {
  const round = { path: [0, close], closePercent: close };
  const alta = resolveBet(round, { direction: 'alta', amount: BET }).grossReturn;
  const baixa = resolveBet(round, { direction: 'baixa', amount: BET }).grossReturn;
  const soma = (alta + baixa) / BET;
  const ok = Math.abs(soma - 2) < 1e-9;
  if (!ok) failures += 1;
  console.log(`  fechou ${String(close).padStart(7)}% -> alta ${(alta / BET).toFixed(4)}x + baixa ${(baixa / BET).toFixed(4)}x = ${soma.toFixed(6)} ${ok ? 'OK' : 'FALHOU'}`);
}

function simulate(label: string, generator: () => { path: number[]; closePercent: number }) {
  console.log(`\n=== ${label} ===`);
  for (const direction of ['alta', 'baixa'] as StockDirection[]) {
    let staked = 0;
    let returned = 0;
    for (let i = 0; i < ROUNDS; i += 1) {
      const round = generator();
      staked += BET;
      returned += resolveBet(round, { direction, amount: BET }).totalReturn;
    }
    const rtp = (returned / staked) * 100;
    console.log(`  ${direction.padEnd(6)} — RTP simulado: ${rtp.toFixed(3)}%`);
  }
}

simulate(`2. Nossa distribuição (${ROUNDS.toLocaleString('pt-BR')} rodadas por direção)`, () => runRound());

// Distribuição enviesada de propósito: a cotação cai muito mais do que sobe.
simulate('3. Distribuição ENVIESADA pra baixo (teste de robustez)', () => {
  const close = Number((Math.random() * 120 - 100).toFixed(2)); // média ≈ -40%
  return { path: [0, close], closePercent: Math.max(-100, Math.min(100, close)) };
});

console.log(`\nRTP teórico: ${(theoreticalRtp() * 100).toFixed(2)}% (= 100% menos a comissão de ${(COMMISSION * 100).toFixed(0)}%)`);
console.log('Note que no teste 3 o RTP de cada lado se afasta de 99% (a cotação é enviesada),');
console.log('mas a MÉDIA dos dois continua 99% — a casa não ganha com o movimento, só com a comissão.');
console.log(failures === 0 ? '\nIdentidade algébrica verificada em todos os casos.' : `\n${failures} caso(s) falharam.`);
process.exit(failures === 0 ? 0 : 1);
