import { apiRequest } from './client';
import { Roadmap } from './roadmap';

export type BaccaratBetType = 'jogador' | 'banca' | 'empate';

export interface BaccaratConfig {
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
}

export interface BaccaratRoundResponse {
  playerCards: string[];
  bankerCards: string[];
  playerTotal: number;
  bankerTotal: number;
  winner: BaccaratBetType;
  betType: BaccaratBetType;
  amount: number;
  totalReturn: number;
  newBalance: number;
  roadmap: Roadmap;
}

export function fetchBaccaratConfig(): Promise<BaccaratConfig> {
  return apiRequest<BaccaratConfig>('/games/bacara/config');
}

export function playBaccaratRound(betType: BaccaratBetType, amount: number, actionId?: string): Promise<BaccaratRoundResponse> {
  return apiRequest<BaccaratRoundResponse>('/games/bacara/apostar', {
    method: 'POST',
    body: { betType, amount },
    actionId,
  });
}

export function fetchBaccaratRoadmap(): Promise<Roadmap> {
  return apiRequest<Roadmap>('/games/bacara/placar');
}
