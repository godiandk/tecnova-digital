import { apiRequest } from './client';

export type StockDirection = 'alta' | 'baixa';

export interface StockMarketConfig {
  minBet: number;
  /**
   * O maior retorno que esta mesa sabe pagar, em múltiplos da aposta.
   *
   * Faz o trilho de fichas parar onde a conta deixa de ser exata — ver
   * `degrauQueCabeNaConta`. Opcional porque um servidor mais velho que este aplicativo
   * não manda o campo, e trancar a mesa por falta dele seria pior que desenhar o degrau
   * puro (o servidor continua sendo quem valida a aposta).
   */
  maiorMultiplicador?: number;
  maxBet: number;
  directions: StockDirection[];
  maxChangePercent: number;
  ticksPerRound: number;
  commission: number;
  theoreticalRtp: number;
}

export interface StockMarketRoundResponse {
  /** O caminho da cotação, ponto a ponto — é o que a tela desenha no gráfico. */
  path: number[];
  direction: StockDirection;
  amount: number;
  closePercent: number;
  grossReturn: number;
  commission: number;
  totalReturn: number;
  newBalance: number;
}

export function fetchStockMarketConfig(): Promise<StockMarketConfig> {
  return apiRequest<StockMarketConfig>('/games/stock-market/config');
}

export function fetchStockMarketHistory(): Promise<{ closes: number[] }> {
  return apiRequest<{ closes: number[] }>('/games/stock-market/historico');
}

export function playStockMarketRound(direction: StockDirection, amount: number, actionId?: string): Promise<StockMarketRoundResponse> {
  return apiRequest<StockMarketRoundResponse>('/games/stock-market/apostar', {
    method: 'POST',
    body: { direction, amount },
    actionId,
  });
}
