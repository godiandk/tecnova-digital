import { apiRequest, MOCK_USER_ID } from './client';

export type BaccaratBetType = 'jogador' | 'banca' | 'empate';

export interface BaccaratConfig {
  minBet: number;
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
}

export function fetchBaccaratConfig(): Promise<BaccaratConfig> {
  return apiRequest<BaccaratConfig>('/games/bacara/config');
}

export function playBaccaratRound(betType: BaccaratBetType, amount: number): Promise<BaccaratRoundResponse> {
  return apiRequest<BaccaratRoundResponse>('/games/bacara/apostar', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, betType, amount },
  });
}
