import {
  ARCO_DA_LINHA,
  BancaFrancesaBetType,
  DICE_COUNT,
  FACES,
  TOTAL_RETURN_MULTIPLIER,
  WINNING_SUMS,
  ehApostaDeLinha,
} from './banca-francesa.config';
import { fracao } from '../shared/rng';

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
  /**
   * Os lançamentos que não decidiram nada, na ordem em que saíram (até 3 guardados).
   *
   * Existem pra a tela poder LANÇAR cada um na tigela em vez de só escrever quantos
   * foram. Não afetam o resultado — o decisivo é `dice`.
   */
  nulos: number[][];
}

/**
 * Um lançamento cru dos três dados, sem julgar se decide.
 *
 * Exportado porque testar a lealdade do dado exige a saída CRUA: medir as faces que
 * saem de rollUntilDecisive dá um resultado enviesado e assustador (1 e 6 aparecendo
 * 17,2% contra 16,3% das outras, qui-quadrado 244), mas o viés é da seleção, não do
 * dado — as somas que decidem são as extremas, então o lançamento que encerra a
 * rodada tende a ter face extrema. O dado está certo; quem estava errado era a medida.
 */
export function rollOnce(random: () => number = fracao): number[] {
  return Array.from({ length: DICE_COUNT }, () => Math.floor(random() * FACES) + 1);
}

function classify(sum: number): DecisiveOutcome | null {
  if (WINNING_SUMS.ases.includes(sum)) return 'ases';
  if (WINNING_SUMS.pequeno.includes(sum)) return 'pequeno';
  if (WINNING_SUMS.grande.includes(sum)) return 'grande';
  return null;
}

/** Quantos lançamentos nulos são guardados pra mostrar. Mais que isso não cabe na tela. */
const NULOS_GUARDADOS = 3;

/**
 * Lança os 3 dados até sair um resultado decisivo (Ases, Pequeno ou Grande) — na
 * mesa real, uma soma "nula" (4, 8 a 13, 17 ou 18) não resolve nada: os dados voltam
 * pro copo e são relançados com as mesmas apostas em pé. Isso normalmente decide
 * rápido (216/63 ≈ 3,4 lançamentos em média), mas o limite evita loop infinito em
 * teoria (praticamente impossível de bater: chance de 1000 nulos seguidos é ~0).
 *
 * OS LANÇAMENTOS NULOS SÃO DEVOLVIDOS, não só contados. Antes só voltava quantos
 * foram, e a tela dizia "os dados voltaram pro copo 4 vezes" — uma frase pedindo pra
 * ser acreditada. Devolvendo os dados de cada tentativa, a tela pode LANÇAR cada uma
 * na tigela: quem está olhando vê o 8 sair, vê não valer, e vê os dados serem jogados
 * de novo. É a diferença entre contar que aconteceu e mostrar acontecendo.
 */
export function rollUntilDecisive(random: () => number = fracao): RollOutcome {
  let rerolls = 0;
  const nulos: number[][] = [];
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const dice = rollOnce(random);
    const sum = dice.reduce((total, die) => total + die, 0);
    const outcome = classify(sum);
    if (outcome) {
      return { dice, sum, outcome, rerolls, nulos };
    }
    if (nulos.length < NULOS_GUARDADOS) nulos.push(dice);
    rerolls += 1;
  }
  throw new Error('Não saiu um resultado decisivo depois de 1000 lançamentos — algo está errado.');
}

/**
 * Resolve cada aposta contra o resultado decisivo.
 *
 * CENTRO (Ases, Pequeno, Grande): a ficha fica dentro do arco. Batendo a soma, paga
 * TOTAL_RETURN_MULTIPLIER; não batendo, perde tudo.
 *
 * LINHA (linha-pequeno, linha-grande): a ficha fica EM CIMA do traço do arco, meio
 * dentro e meio fora, e é isso que a divide: metade dela está apostada, metade não.
 * Ganhando, você recebe a aposta mais metade dela (1,5x); perdendo, recebe a metade
 * que nunca esteve em risco (0,5x). É literalmente a aposta do centro com metade do
 * valor — apostar 100 na linha do Grande é apostar 50 no centro do Grande e guardar
 * 50 no bolso.
 *
 * E é por ser exatamente isso que a matemática fecha sozinha: o RTP da linha é a média
 * entre o RTP do centro e 100% (a metade guardada sempre volta), o que dá 99,21% —
 * metade da vantagem da casa, porque metade do dinheiro nem chega a jogar. Menos risco
 * e menos prêmio, sem nenhum truque no meio.
 */
export function resolveBets(outcome: DecisiveOutcome, bets: BancaFrancesaBet[]): BetResult[] {
  return bets.map((bet) => {
    if (ehApostaDeLinha(bet.type)) {
      const metade = bet.amount / 2;
      const won = outcome === ARCO_DA_LINHA[bet.type];
      // A metade guardada volta sempre; a apostada paga 1 por 1 quando bate.
      return { ...bet, won, totalReturn: won ? bet.amount + metade : metade };
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

  const caminhosDe = (tipo: 'ases' | 'pequeno' | 'grande') =>
    tipo === 'ases' ? waysAses : tipo === 'pequeno' ? waysPequeno : waysGrande;

  if (ehApostaDeLinha(betType)) {
    /*
     * Metade do dinheiro está no centro do arco e metade não está apostada. O retorno
     * é a média dos dois: (RTP do centro + 100%) / 2. Com o centro em 31/63 × 2 =
     * 98,41%, a linha dá 99,21% — exatamente metade da vantagem da casa.
     */
    const doCentro = (caminhosDe(ARCO_DA_LINHA[betType]) / decisive) * 2;
    return (doCentro + 1) / 2;
  }
  return (caminhosDe(betType) / decisive) * TOTAL_RETURN_MULTIPLIER[betType];
}
