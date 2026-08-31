import {
  BANKER_TOTAL_MULTIPLIER,
  BaccaratBetType,
  PLAYER_TOTAL_MULTIPLIER,
  PUSH_TOTAL_MULTIPLIER,
  Rank,
  TIE_TOTAL_MULTIPLIER,
} from './baccarat.config';

export type Winner = 'jogador' | 'banca' | 'empate';

/**
 * De onde as cartas saem. Numa mesa é a sapata de 8 baralhos; os testes passam a sua
 * pra poder forçar situações. O motor não sabe (nem precisa saber) qual das duas é.
 */
export type FonteDeCartas = () => Rank;

/** A=1, 2-9 valem o próprio número, 10/J/Q/K valem 0 — regra do bacará, não do blackjack. */
function cardValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

/** Só o último dígito da soma conta — por isso "total" nunca passa de 9. */
export function handTotal(cards: Rank[]): number {
  return cards.reduce((sum, card) => sum + cardValue(card), 0) % 10;
}

export interface RoundResult {
  playerCards: Rank[];
  bankerCards: Rank[];
  playerTotal: number;
  bankerTotal: number;
  winner: Winner;
}

/**
 * Tabela de compra da 3ª carta do Punto Banco — o jogador nunca decide nada aqui,
 * é toda regra fixa. Ver server/README.md para a tabela por extenso.
 */
export function playRound(comprar: FonteDeCartas): RoundResult {
  // Na mesa as cartas saem alternadas: jogador, banca, jogador, banca.
  const p1 = comprar();
  const b1 = comprar();
  const p2 = comprar();
  const b2 = comprar();
  const playerCards: Rank[] = [p1, p2];
  const bankerCards: Rank[] = [b1, b2];

  const playerTotalBeforeDraw = handTotal(playerCards);
  const bankerTotalBeforeDraw = handTotal(bankerCards);
  const natural = playerTotalBeforeDraw >= 8 || bankerTotalBeforeDraw >= 8;

  if (!natural) {
    let playerThirdCardValue: number | undefined;

    if (playerTotalBeforeDraw <= 5) {
      const thirdCard = comprar();
      playerCards.push(thirdCard);
      playerThirdCardValue = cardValue(thirdCard);
    }

    const bankerShouldDraw = (): boolean => {
      if (playerThirdCardValue === undefined) {
        // Jogador não comprou — banca segue a mesma regra do jogador (compra com 0-5, para com 6-7).
        return bankerTotalBeforeDraw <= 5;
      }
      if (bankerTotalBeforeDraw <= 2) return true;
      if (bankerTotalBeforeDraw === 3) return playerThirdCardValue !== 8;
      if (bankerTotalBeforeDraw === 4) return playerThirdCardValue >= 2 && playerThirdCardValue <= 7;
      if (bankerTotalBeforeDraw === 5) return playerThirdCardValue >= 4 && playerThirdCardValue <= 7;
      if (bankerTotalBeforeDraw === 6) return playerThirdCardValue === 6 || playerThirdCardValue === 7;
      return false; // banca com 7 sempre para
    };

    if (bankerShouldDraw()) {
      bankerCards.push(comprar());
    }
  }

  const playerTotal = handTotal(playerCards);
  const bankerTotal = handTotal(bankerCards);
  const winner: Winner = playerTotal > bankerTotal ? 'jogador' : playerTotal < bankerTotal ? 'banca' : 'empate';

  return { playerCards, bankerCards, playerTotal, bankerTotal, winner };
}

export function resolveBet(betType: BaccaratBetType, winner: Winner, amount: number): number {
  if (betType === winner) {
    if (winner === 'jogador') return amount * PLAYER_TOTAL_MULTIPLIER;
    if (winner === 'banca') return amount * BANKER_TOTAL_MULTIPLIER;
    return amount * TIE_TOTAL_MULTIPLIER;
  }
  if (winner === 'empate' && (betType === 'jogador' || betType === 'banca')) {
    return amount * PUSH_TOTAL_MULTIPLIER;
  }
  return 0;
}
