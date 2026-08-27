/**
 * Stock Market — jogo em que você aposta se uma "ação" vai subir ou descer. A cotação
 * varia durante a rodada e fecha num valor entre -100% e +100%. Você ganha exatamente
 * a porcentagem do movimento que acertou: apostou em ALTA e fechou em +25%, recebe
 * 25% da aposta de lucro.
 *
 * Formato baseado no Stock Market da Evolution (regras conferidas em
 * livecasinocomparer.com e evolution.com, agosto/2026). A distribuição exata do
 * movimento da cotação é proprietária deles e não é publicada, então aqui a gente usa
 * a nossa, documentada em stock-market.engine.ts — e isso NÃO muda o RTP, pela razão
 * demonstrada em verify-rtp.ts: como o pagamento é simétrico e linear no movimento, a
 * casa não ganha nada do movimento em si. A única vantagem da casa é a comissão
 * explícita abaixo.
 */
export type StockDirection = 'alta' | 'baixa';

/** Limites do movimento da cotação, em pontos percentuais. */
export const MAX_CHANGE_PERCENT = 100;

/**
 * Comissão da casa, cobrada sobre o valor devolvido. É a ÚNICA vantagem da casa neste
 * jogo — sem ela o RTP seria exatamente 100%. 1% deixa o RTP em 99%.
 */
export const COMMISSION = 0.01;

export const MIN_BET = 50;
export const MAX_BET = 5000;

/** Quantos passos a cotação dá durante a rodada (é o que o gráfico desenha). */
export const TICKS_PER_ROUND = 30;
