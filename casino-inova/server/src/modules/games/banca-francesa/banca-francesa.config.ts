/**
 * Banca Francesa "de verdade" (também chamada "Grande e Pequena", jogo tradicional
 * dos casinos portugueses): 3 dados de 6 faces, aposta-se na SOMA dos 3 dados, não
 * num número específico. Regras conferidas em observador.pt, BacanaPlay, 888.pt e na
 * Wikipédia em português (agosto/2026).
 *
 * Cinco lugares de aposta, porque a mesa tem CENTRO e LINHA:
 * - Ases: soma = 3 (só sai com os 3 dados mostrando 1). Paga 61 por 1. Só tem centro:
 *   uma aposta que já paga 61 por 1 não precisa de versão de risco reduzido.
 * - Centro do Pequeno: soma 5, 6 ou 7. Paga 1 por 1 e, perdendo, perde tudo.
 * - Centro do Grande: soma 14, 15 ou 16. Idem.
 * - Linha do Pequeno e Linha do Grande: a ficha vai EM CIMA do traço do arco, não
 *   dentro dele. Ganhando, ganha METADE do valor apostado; perdendo, perde só metade.
 *   É a mesma aposta do centro com metade do risco e metade do prêmio — na prática,
 *   apostar 100 na linha é apostar 50 no centro e guardar 50.
 *
 * Qualquer outra soma (4, 8 a 13, 17 ou 18) é NULA: os dados são relançados e as
 * apostas continuam em pé até sair um resultado decisivo — por isso o RTP de cada
 * aposta é calculado condicionado a um lançamento decisivo, não sobre todas as 216
 * combinações possíveis dos 3 dados.
 */
export const DICE_COUNT = 3;
export const FACES = 6;

export type ApostaDeCentro = 'ases' | 'pequeno' | 'grande';
export type ApostaDeLinha = 'linha-pequeno' | 'linha-grande';
export type BancaFrancesaBetType = ApostaDeCentro | ApostaDeLinha;

export const BET_TYPES: BancaFrancesaBetType[] = ['ases', 'pequeno', 'grande', 'linha-pequeno', 'linha-grande'];

/** Cada linha acompanha um arco: é a mesma soma, com metade do risco. */
export const ARCO_DA_LINHA: Record<ApostaDeLinha, 'pequeno' | 'grande'> = {
  'linha-pequeno': 'pequeno',
  'linha-grande': 'grande',
};

export function ehApostaDeLinha(tipo: BancaFrancesaBetType): tipo is ApostaDeLinha {
  return tipo === 'linha-pequeno' || tipo === 'linha-grande';
}

/** Somas que cada aposta cobre — usado tanto pra resolver quanto pra descrever a mesa no app. */
export const WINNING_SUMS: Record<ApostaDeCentro, number[]> = {
  ases: [3],
  pequeno: [5, 6, 7],
  grande: [14, 15, 16],
};

/**
 * Retorno TOTAL sobre a aposta (aposta devolvida + prêmio), não só o prêmio.
 * Ases "paga 61 para 1" nas casas portuguesas → prêmio de 61x, retorno total 62x.
 * Grande e Pequeno "pagam 1 para 1" → retorno total 2x.
 * As linhas não entram aqui porque o retorno delas não é múltiplo da aposta cheia:
 * ganhando devolvem 1,5x (a aposta mais metade dela) e perdendo devolvem 0,5x. Ver
 * resolveBets em banca-francesa.engine.ts.
 */
export const TOTAL_RETURN_MULTIPLIER: Record<ApostaDeCentro, number> = {
  ases: 62,
  pequeno: 2,
  grande: 2,
};

export const MIN_BET = 50;
export const MAX_BET = 5000;
/** Quantas apostas diferentes dá pra fazer na mesma rodada — uma por lugar da mesa. */
export const MAX_SIMULTANEOUS_BETS = BET_TYPES.length;

/**
 * A aposta na linha é dividida ao meio, e o saldo é guardado em número inteiro de
 * fichas (a coluna `amount` do ledger é BIGINT). Metade de um valor ímpar não é
 * inteira, então valor ímpar na linha é recusado.
 *
 * Arredondar seria pior de qualquer lado: pra cima, uma aposta de 55 devolveria mais
 * do que a conta manda e o RTP passaria de 100%; pra baixo, a casa ficaria com meia
 * ficha escondida em toda aposta ímpar. Recusar é a única opção que mantém a conta
 * exata, e o aplicativo avisa antes de deixar confirmar — não é uma regra que morde
 * depois.
 */
export function apostaDeLinhaEhValida(valor: number): boolean {
  return Number.isInteger(valor) && valor % 2 === 0;
}
