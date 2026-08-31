import { Card, HAND_CATEGORY_LABEL, Rank, SUITS } from './poker.config';
import { fracao } from '../shared/rng';

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank += 1) {
      deck.push({ rank: rank as Rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], random: () => number = fracao): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface HandValue {
  /** 0 = carta alta, 8 = straight flush — ver HAND_CATEGORY_LABEL. */
  category: number;
  /** Desempate dentro da mesma categoria, do mais importante pro menos importante. */
  tiebreak: number[];
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function evaluateFive(cards: Card[]): HandValue {
  const ranksDesc = cards.map((card) => card.rank).sort((a, b) => b - a);
  const isFlush = cards.every((card) => card.suit === cards[0].suit);

  const uniqueRanksDesc = [...new Set(ranksDesc)];
  let straightHigh: number | null = null;
  if (uniqueRanksDesc.length === 5) {
    if (uniqueRanksDesc[0] - uniqueRanksDesc[4] === 4) {
      straightHigh = uniqueRanksDesc[0];
    } else if (uniqueRanksDesc.join(',') === '14,5,4,3,2') {
      straightHigh = 5; // sequência "do bebê" (A-2-3-4-5), o Ás conta como 1 aqui
    }
  }

  const counts = new Map<number, number>();
  for (const rank of ranksDesc) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pattern = groups.map(([, count]) => count);
  const groupRanks = groups.map(([rank]) => rank);

  if (straightHigh !== null && isFlush) return { category: 8, tiebreak: [straightHigh] };
  if (pattern[0] === 4) return { category: 7, tiebreak: groupRanks };
  if (pattern[0] === 3 && pattern[1] === 2) return { category: 6, tiebreak: groupRanks };
  if (isFlush) return { category: 5, tiebreak: ranksDesc };
  if (straightHigh !== null) return { category: 4, tiebreak: [straightHigh] };
  if (pattern[0] === 3) return { category: 3, tiebreak: groupRanks };
  if (pattern[0] === 2 && pattern[1] === 2) return { category: 2, tiebreak: groupRanks };
  if (pattern[0] === 2) return { category: 1, tiebreak: groupRanks };
  return { category: 0, tiebreak: ranksDesc };
}

export function compareHandValues(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i += 1) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Melhor mão de 5 cartas entre as 7 disponíveis (2 na mão + 5 na mesa) — testa as 21 combinações possíveis. */
export function bestHandOf(cards: Card[]): HandValue {
  let best: HandValue | null = null;
  for (const combo of combinations(cards, 5)) {
    const value = evaluateFive(combo);
    if (!best || compareHandValues(value, best) > 0) {
      best = value;
    }
  }
  return best!;
}

export function handLabel(value: HandValue): string {
  if (value.category === 8 && value.tiebreak[0] === 14) return 'Royal flush';
  return HAND_CATEGORY_LABEL[value.category];
}

function preflopStrength(hole: Card[]): number {
  const [a, b] = hole;
  let score = a.rank + b.rank; // 4 a 28
  if (a.rank === b.rank) score += 10; // par
  if (a.suit === b.suit) score += 3; // mesmo naipe
  if (Math.abs(a.rank - b.rank) <= 2) score += 2; // cartas próximas, mais fácil formar sequência
  return score / 43; // normaliza pra ~0-1
}

export type PokerAction = 'desistir' | 'passar' | 'pagar' | 'aumentar';

/**
 * Heurística simples, não estratégia ótima: estima força da mão (pré-flop pelas
 * cartas na mão, depois pela categoria da melhor mão possível) e decide com uma
 * pitada de aleatoriedade — inclusive blefando às vezes — em vez de jogar "perfeito".
 */
export function botDecision(botHole: Card[], board: Card[], betToCall: number, random: () => number = fracao): PokerAction {
  const strength = board.length === 0 ? preflopStrength(botHole) : bestHandOf([...botHole, ...board]).category / 8;
  const bluff = random() < 0.08;

  if (betToCall === 0) {
    return strength > 0.55 || bluff ? 'aumentar' : 'passar';
  }

  if (strength > 0.7 || bluff) return 'aumentar';
  if (strength > 0.3) return 'pagar';
  return random() < 0.15 ? 'pagar' : 'desistir';
}
