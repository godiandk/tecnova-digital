import { Card, RANKS, SUITS, TrucoRank } from './truco.config';

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A manilha é o rank seguinte ao da carta virada, dando a volta depois do 3. */
export function manilhaRankFor(vira: Card): TrucoRank {
  const index = RANKS.indexOf(vira.rank);
  return RANKS[(index + 1) % RANKS.length];
}

/**
 * Força numérica de uma carta pra comparação direta — manilhas (10-13) sempre batem
 * cartas normais (0-9), e entre manilhas o naipe desempata pela ordem de `SUITS`.
 */
export function cardStrength(card: Card, manilhaRank: TrucoRank): number {
  if (card.rank === manilhaRank) {
    return 10 + SUITS.indexOf(card.suit);
  }
  return RANKS.indexOf(card.rank);
}

/** Positivo = `a` vence, negativo = `b` vence, zero = empate (mesma força, naipe não desempata fora de manilha). */
export function compareCards(a: Card, b: Card, manilhaRank: TrucoRank): number {
  return cardStrength(a, manilhaRank) - cardStrength(b, manilhaRank);
}

export type RoundResult = 'jogador' | 'bot' | 'empate';
export type HandOutcome = 'jogador' | 'bot' | 'ninguem' | 'pendente';

/**
 * Regra clássica de desempate do truco: quem empata a primeira rodada perde o
 * "direito" — quem ganhar a segunda leva a mão. Quem ganha a primeira e empata a
 * segunda já leva (o outro lado não alcança mais 2 vitórias). Só quando as duas
 * primeiras rodadas têm vencedores diferentes é que a terceira decide de verdade.
 */
export function resolveHand(results: RoundResult[]): HandOutcome {
  const [r1, r2, r3] = results;

  if (!r1) return 'pendente';

  if (r1 !== 'empate') {
    if (!r2) return 'pendente';
    if (r2 === r1 || r2 === 'empate') return r1;
    if (!r3) return 'pendente';
    return r3 === 'empate' ? r1 : r3;
  }

  if (!r2) return 'pendente';
  if (r2 !== 'empate') return r2;
  if (!r3) return 'pendente';
  return r3 === 'empate' ? 'ninguem' : r3;
}

function handStrengthScore(hand: Card[], manilhaRank: TrucoRank): number {
  return hand.reduce((sum, card) => sum + cardStrength(card, manilhaRank), 0);
}

/** Bot simples: sem carta do adversário na rodada, joga a mais fraca; respondendo, joga a mais fraca que ainda vence — e só sobe pra mais forte se nenhuma vencer. */
export function chooseBotCard(botHand: Card[], opponentCard: Card | undefined, manilhaRank: TrucoRank): Card {
  const sorted = [...botHand].sort((a, b) => cardStrength(a, manilhaRank) - cardStrength(b, manilhaRank));
  if (!opponentCard) {
    return sorted[0];
  }
  const winning = sorted.find((card) => compareCards(card, opponentCard, manilhaRank) > 0);
  return winning ?? sorted[0];
}

/** Aceita se a mão ainda tem uma manilha ou uma carta ≥ Ás — só blefa aceitando fraco 1 em cada 5 vezes. */
export function botTrucoDecision(botHand: Card[], manilhaRank: TrucoRank, random: () => number = Math.random): boolean {
  const strong = botHand.some((card) => cardStrength(card, manilhaRank) >= RANKS.indexOf('A'));
  if (strong) return true;
  return random() < 0.2;
}

/** Chance de o bot pedir truco antes de jogar, só quando a mão tá mesmo forte. */
export function botShouldCallTruco(botHand: Card[], manilhaRank: TrucoRank, random: () => number = Math.random): boolean {
  const manilhaCount = botHand.filter((card) => card.rank === manilhaRank).length;
  const avgStrength = handStrengthScore(botHand, manilhaRank) / Math.max(botHand.length, 1);
  if (manilhaCount >= 1 && avgStrength >= 9) return random() < 0.6;
  return false;
}
