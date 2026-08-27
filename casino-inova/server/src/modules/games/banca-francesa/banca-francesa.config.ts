/**
 * Banca Francesa "de verdade" (também chamada "Grande e Pequena", jogo tradicional
 * dos casinos portugueses): 3 dados de 6 faces, aposta-se na SOMA dos 3 dados, não
 * num número específico. Regras conferidas em observador.pt, BacanaPlay, 888.pt e na
 * Wikipédia em português (agosto/2026).
 *
 * Quatro apostas possíveis:
 * - Ases: soma = 3 (só sai com os 3 dados mostrando 1)
 * - Pequeno: soma = 5, 6 ou 7
 * - Grande: soma = 14, 15 ou 16
 * - Linha: aposta "dividida" entre Grande e Pequeno (ver banca-francesa.engine.ts)
 *
 * Qualquer outra soma (4, 8 a 13, 17 ou 18) é NULA: os dados são relançados e as
 * apostas continuam em pé até sair um resultado decisivo — por isso o RTP de cada
 * aposta é calculado condicionado a um lançamento decisivo, não sobre todas as 216
 * combinações possíveis dos 3 dados.
 */
export const DICE_COUNT = 3;
export const FACES = 6;

export type BancaFrancesaBetType = 'ases' | 'pequeno' | 'grande' | 'linha';

export const BET_TYPES: BancaFrancesaBetType[] = ['ases', 'pequeno', 'grande', 'linha'];

/** Somas que cada aposta cobre — usado tanto pra resolver quanto pra descrever a mesa no app. */
export const WINNING_SUMS: Record<Exclude<BancaFrancesaBetType, 'linha'>, number[]> = {
  ases: [3],
  pequeno: [5, 6, 7],
  grande: [14, 15, 16],
};

/**
 * Retorno TOTAL sobre a aposta (aposta devolvida + prêmio), não só o prêmio.
 * Ases "paga 61 para 1" nas casas portuguesas → prêmio de 61x, retorno total 62x.
 * Grande e Pequeno "pagam 1 para 1" → retorno total 2x.
 * Linha: ver o comentário em banca-francesa.engine.ts sobre a reconciliação da fonte —
 * o multiplicador efetivo da Linha não é fixo, ele nasce de resolver meia aposta em
 * Grande e meia em Pequeno, então não tem uma entrada única aqui.
 */
export const TOTAL_RETURN_MULTIPLIER: Record<Exclude<BancaFrancesaBetType, 'linha'>, number> = {
  ases: 62,
  pequeno: 2,
  grande: 2,
};

export const MIN_BET = 50;
export const MAX_BET = 5000;
/** Quantas apostas diferentes (ases/pequeno/grande/linha) dá pra fazer na mesma rodada. */
export const MAX_SIMULTANEOUS_BETS = BET_TYPES.length;
