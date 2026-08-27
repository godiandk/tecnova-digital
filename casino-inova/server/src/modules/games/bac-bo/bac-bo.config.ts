/**
 * Bac Bo — bacará jogado com dados, criado pela Evolution. Quatro dados de 6 faces:
 * dois formam o total do Player, dois formam o total do Banker. Ganha o lado de maior
 * soma. Regras e tabela de pagamento conferidas na Wizard of Odds (agosto/2026) e
 * recalculadas por conta própria em verify-rtp.ts — os dois batem.
 *
 * Não tem regra de compra de carta como no bacará clássico: os dados saem e pronto,
 * o que torna o jogo bem mais simples de entender e de auditar.
 */
export const DICE_PER_SIDE = 2;
export const FACES = 6;

export type BacBoBetType = 'jogador' | 'banca' | 'empate';

/** Player e Banker pagam 1 pra 1 → retorno TOTAL de 2x (aposta de volta + prêmio igual). */
export const SIDE_TOTAL_MULTIPLIER = 2;

/**
 * No empate, quem apostou em jogador/banca NÃO perde tudo nem recebe de volta inteiro:
 * perde 10% da aposta e leva 90% de volta. É essa regra (em vez de devolver a ficha
 * inteira, como faz o bacará clássico) que gera toda a vantagem da casa nesse jogo.
 */
export const TIE_REFUND_MULTIPLIER = 0.9;

/**
 * Aposta no empate: o prêmio depende de QUAL total empatou — empate em 2 ou 12 é bem
 * mais raro que em 7, então paga muito mais. Valores em "X pra 1" (só o lucro); o
 * retorno total é X + 1.
 */
export const TIE_PROFIT_ODDS: Record<number, number> = {
  2: 88,
  3: 25,
  4: 10,
  5: 6,
  6: 4,
  7: 4,
  8: 4,
  9: 6,
  10: 10,
  11: 25,
  12: 88,
};

export const MIN_BET = 50;
export const MAX_BET = 5000;
