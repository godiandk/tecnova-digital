import { Card, MINEIRO_FIXED_MANILHAS, RANKS, SUITS, TrucoRank, TrucoVariant, VARIANT_RULES } from './truco.config';

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
 * O que define a manilha na mão atual. No paulista é um rank (sai da vira); no
 * mineiro não existe vira, então é `null` e valem as quatro cartas fixas.
 */
export type ManilhaContext = { variant: TrucoVariant; manilhaRank: TrucoRank | null };

/**
 * Força numérica de uma carta — manilhas sempre batem carta normal, e entre manilhas
 * o desempate segue ouros < espadas < copas < paus nas duas variantes.
 *
 * Paulista: é manilha toda carta cujo rank bate com o rank da vez; o naipe ordena.
 * Mineiro: só as quatro cartas fixas são manilha, na ordem definida na config.
 */
export function cardStrength(card: Card, context: ManilhaContext): number {
  if (context.variant === 'mineiro') {
    const index = MINEIRO_FIXED_MANILHAS.findIndex(
      (item) => item.card.rank === card.rank && item.card.suit === card.suit,
    );
    if (index !== -1) return 10 + index;
    return RANKS.indexOf(card.rank);
  }

  if (context.manilhaRank !== null && card.rank === context.manilhaRank) {
    return 10 + SUITS.indexOf(card.suit);
  }
  return RANKS.indexOf(card.rank);
}

/** Positivo = `a` vence, negativo = `b` vence, zero = empate (mesma força, naipe não desempata fora de manilha). */
export function compareCards(a: Card, b: Card, context: ManilhaContext): number {
  return cardStrength(a, context) - cardStrength(b, context);
}

/** Se a carta é manilha na variante em jogo — usado pelo bot e pela tela. */
export function isManilha(card: Card, context: ManilhaContext): boolean {
  return cardStrength(card, context) >= 10;
}

/** Apelido da manilha no mineiro (zap, copeta, espadilha, mole) — null se não for manilha. */
export function manilhaNickname(card: Card): string | null {
  return MINEIRO_FIXED_MANILHAS.find(
    (item) => item.card.rank === card.rank && item.card.suit === card.suit,
  )?.nickname ?? null;
}

/** Pontos que a variante exige pra vencer — atalho pra quem só tem a variante em mãos. */
export function pointsToWin(variant: TrucoVariant): number {
  return VARIANT_RULES[variant].pointsToWinMatch;
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

function handStrengthScore(hand: Card[], context: ManilhaContext): number {
  return hand.reduce((sum, card) => sum + cardStrength(card, context), 0);
}

/** Bot simples: sem carta do adversário na rodada, joga a mais fraca; respondendo, joga a mais fraca que ainda vence — e só sobe pra mais forte se nenhuma vencer. */
export function chooseBotCard(botHand: Card[], opponentCard: Card | undefined, context: ManilhaContext): Card {
  const sorted = [...botHand].sort((a, b) => cardStrength(a, context) - cardStrength(b, context));
  if (!opponentCard) {
    return sorted[0];
  }
  const winning = sorted.find((card) => compareCards(card, opponentCard, context) > 0);
  return winning ?? sorted[0];
}

/** Aceita se a mão ainda tem uma manilha ou uma carta ≥ Ás — só blefa aceitando fraco 1 em cada 5 vezes. */
export function botTrucoDecision(botHand: Card[], context: ManilhaContext, random: () => number = Math.random): boolean {
  const strong = botHand.some((card) => cardStrength(card, context) >= RANKS.indexOf('A'));
  if (strong) return true;
  return random() < 0.2;
}

/** Chance de o bot pedir truco antes de jogar, só quando a mão tá mesmo forte. */
export function botShouldCallTruco(botHand: Card[], context: ManilhaContext, random: () => number = Math.random): boolean {
  const manilhaCount = botHand.filter((card) => isManilha(card, context)).length;
  const avgStrength = handStrengthScore(botHand, context) / Math.max(botHand.length, 1);
  if (manilhaCount >= 1 && avgStrength >= 9) return random() < 0.6;
  return false;
}
