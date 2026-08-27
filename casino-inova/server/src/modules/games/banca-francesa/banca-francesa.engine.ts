import {
  BancaFrancesaBetType,
  DICE_COUNT,
  FACES,
  TOTAL_RETURN_MULTIPLIER,
  WINNING_SUMS,
} from './banca-francesa.config';

export interface BancaFrancesaBet {
  type: BancaFrancesaBetType;
  amount: number;
}

export interface BetResult extends BancaFrancesaBet {
  won: boolean;
  totalReturn: number;
}

export type DecisiveOutcome = 'ases' | 'pequeno' | 'grande';

export interface RollOutcome {
  /** O último lançamento (decisivo) — os relançamentos intermediários não importam pro jogador. */
  dice: number[];
  sum: number;
  outcome: DecisiveOutcome;
  /** Quantos lançamentos nulos aconteceram antes do decisivo — só informativo, não afeta o resultado. */
  rerolls: number;
}

function rollOnce(random: () => number): number[] {
  return Array.from({ length: DICE_COUNT }, () => Math.floor(random() * FACES) + 1);
}

function classify(sum: number): DecisiveOutcome | null {
  if (WINNING_SUMS.ases.includes(sum)) return 'ases';
  if (WINNING_SUMS.pequeno.includes(sum)) return 'pequeno';
  if (WINNING_SUMS.grande.includes(sum)) return 'grande';
  return null;
}

/**
 * Lança os 3 dados até sair um resultado decisivo (Ases, Pequeno ou Grande) — na
 * mesa real, uma soma "nula" (4, 8 a 13, 17 ou 18) não resolve nada: os dados voltam
 * pro copo e são relançados com as mesmas apostas em pé. Isso normalmente decide
 * rápido (216/63 ≈ 3,4 lançamentos em média), mas o limite evita loop infinito em
 * teoria (praticamente impossível de bater: chance de 1000 nulos seguidos é ~0).
 */
export function rollUntilDecisive(random: () => number = Math.random): RollOutcome {
  let rerolls = 0;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const dice = rollOnce(random);
    const sum = dice.reduce((total, die) => total + die, 0);
    const outcome = classify(sum);
    if (outcome) {
      return { dice, sum, outcome, rerolls };
    }
    rerolls += 1;
  }
  throw new Error('Não saiu um resultado decisivo depois de 1000 lançamentos — algo está errado.');
}

/**
 * Resolve cada aposta contra o resultado decisivo.
 *
 * Ases/Pequeno/Grande: aposta direta, paga TOTAL_RETURN_MULTIPLIER se a soma bater.
 *
 * Linha (meia linha): fichas colocadas na linha que separa Grande de Pequeno na mesa
 * real. As fontes descrevendo essa aposta (observador.pt, BacanaPlay, 888.pt) usam
 * frases um pouco diferentes umas das outras — a leitura mais consistente com um jogo
 * de casa real (RTP < 100%) é que a Linha equivale a dividir a ficha ao meio: metade
 * apostada em Pequeno, metade em Grande, cada metade paga 1 pra 1 isoladamente. Isso
 * significa: se sair Pequeno ou Grande, a metade certa te devolve exatamente o que a
 * aposta valia (nem lucro nem prejuízo); se sair Ases, as duas metades perdem. O RTP
 * resultante (62/63 ≈ 98,41%) bate exatamente com o RTP de apostar só em Pequeno, só
 * em Grande, ou só em Ases — ou seja, a Linha não dá nem tira vantagem, só reduz a
 * variância igual apostar em mais de um número na roleta. Ver theoreticalRtp() abaixo.
 */
export function resolveBets(outcome: DecisiveOutcome, bets: BancaFrancesaBet[]): BetResult[] {
  return bets.map((bet) => {
    if (bet.type === 'linha') {
      const half = bet.amount / 2;
      const totalReturn = outcome === 'ases' ? 0 : half * 2;
      return { ...bet, won: outcome !== 'ases', totalReturn };
    }
    const won = bet.type === outcome;
    const totalReturn = won ? bet.amount * TOTAL_RETURN_MULTIPLIER[bet.type] : 0;
    return { ...bet, won, totalReturn };
  });
}

/** Nº de combinações dos 3 dados (de 216) que somam exatamente `sum` — convolução de 3 d6. */
function waysForSum(sum: number): number {
  let ways = 0;
  for (let a = 1; a <= FACES; a += 1) {
    for (let b = 1; b <= FACES; b += 1) {
      const c = sum - a - b;
      if (c >= 1 && c <= FACES) ways += 1;
    }
  }
  return ways;
}

/**
 * RTP exato por fórmula fechada, condicionado a um lançamento decisivo (é o espaço
 * amostral que importa — lançamentos nulos só adiam o resultado, nunca resolvem a
 * aposta). Dos 216 resultados possíveis, 63 são decisivos: 1 Ases + 31 Pequeno + 31
 * Grande. P(ases)=1/63, P(pequeno)=P(grande)=31/63.
 */
export function theoreticalRtp(betType: BancaFrancesaBetType): number {
  const waysAses = waysForSum(3);
  const waysPequeno = WINNING_SUMS.pequeno.reduce((sum, value) => sum + waysForSum(value), 0);
  const waysGrande = WINNING_SUMS.grande.reduce((sum, value) => sum + waysForSum(value), 0);
  const decisive = waysAses + waysPequeno + waysGrande;

  if (betType === 'linha') {
    return (waysPequeno + waysGrande) / decisive;
  }
  const ways = betType === 'ases' ? waysAses : betType === 'pequeno' ? waysPequeno : waysGrande;
  return (ways / decisive) * TOTAL_RETURN_MULTIPLIER[betType];
}
