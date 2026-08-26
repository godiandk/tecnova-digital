import { drawCard, handValue, isBust, isNatural, playDealer, resolve } from './blackjack.engine';
import { Rank } from './blackjack.config';

/**
 * Ao contrário de slots e roleta, blackjack NÃO tem um RTP fixo — depende de como o
 * jogador joga. Isso simula uma estratégia simples (pedir carta enquanto o total for
 * menor que 17, igual à regra do dealer) só para ter um número de referência e
 * confirmar que o jogo não está nem escandalosamente generoso nem escandalosamente
 * apertado. Estratégia básica ótima de verdade chega mais perto de ~99,5% com essas
 * regras (dealer para em todos os 17, blackjack paga 3:2, baralho infinito).
 *
 *   npx ts-node src/modules/games/blackjack/verify-strategy.ts
 */
const HANDS = 300_000;
const BET = 100;

function playHandNaiveStrategy(): number {
  const playerCards: Rank[] = [drawCard(), drawCard()];
  let dealerCards: Rank[] = [drawCard(), drawCard()];

  if (isNatural(playerCards) || isNatural(dealerCards)) {
    return resolve(playerCards, dealerCards, BET).totalReturn;
  }

  while (handValue(playerCards) < 17 && !isBust(playerCards)) {
    playerCards.push(drawCard());
  }

  if (!isBust(playerCards)) {
    dealerCards = playDealer(dealerCards);
  }

  return resolve(playerCards, dealerCards, BET).totalReturn;
}

let totalBet = 0;
let totalReturned = 0;

for (let i = 0; i < HANDS; i += 1) {
  totalBet += BET;
  totalReturned += playHandNaiveStrategy();
}

console.log(`Estratégia simulada: pedir carta até 17, igual ao dealer.`);
console.log(`RTP simulado (${HANDS.toLocaleString('pt-BR')} mãos): ${((totalReturned / totalBet) * 100).toFixed(2)}%`);
