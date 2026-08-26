import { playRound, resolveBet } from './baccarat.engine';
import { BaccaratBetType } from './baccarat.config';

/**
 * Diferente do blackjack, bacará não tem nenhuma decisão do jogador — a regra de
 * compra da 3ª carta é toda fixa. Isso significa que, diferente do blackjack, o RTP
 * de cada tipo de aposta É um número fixo de verdade, só que complexo demais pra
 * calcular à mão por fórmula fechada (a tabela de compra tem várias ramificações).
 * Por isso aqui é simulação, não fórmula — mas ainda é o RTP real, não uma
 * aproximação sob uma estratégia, porque não existe estratégia possível no bacará.
 *
 *   npx ts-node src/modules/games/baccarat/verify-rtp.ts
 */
const ROUNDS = 1_000_000;
const BET = 100;
const BET_TYPES: BaccaratBetType[] = ['jogador', 'banca', 'empate'];

const totalReturned: Record<BaccaratBetType, number> = { jogador: 0, banca: 0, empate: 0 };

for (let i = 0; i < ROUNDS; i += 1) {
  const round = playRound();
  for (const betType of BET_TYPES) {
    totalReturned[betType] += resolveBet(betType, round.winner, BET);
  }
}

const totalBet = ROUNDS * BET;
for (const betType of BET_TYPES) {
  const rtp = (totalReturned[betType] / totalBet) * 100;
  console.log(`RTP em "${betType}": ${rtp.toFixed(2)}%`);
}
console.log('Referência de mercado (sapata de 8 baralhos, sem reposição): jogador ~98,76%, banca ~98,94%, empate ~85,64%.');
console.log('Aqui o baralho é "infinito" (com reposição), então os números ficam próximos, mas não idênticos.');
