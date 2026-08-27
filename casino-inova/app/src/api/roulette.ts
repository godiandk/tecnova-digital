import { apiRequest, MOCK_USER_ID } from './client';
import { RouletteHistory } from '../components/RouletteHistoryPanel';

export type RouletteBetType =
  | 'numero'
  | 'vermelho'
  | 'preto'
  | 'par'
  | 'impar'
  | 'baixo'
  | 'alto'
  | 'duzia1'
  | 'duzia2'
  | 'duzia3';

export interface RouletteBet {
  type: RouletteBetType;
  number?: number;
}

export interface RouletteConfig {
  minBet: number;
  maxBet: number;
  redNumbers: number[];
  totalMultiplier: Record<RouletteBetType, number>;
  theoreticalRtp: number;
}

export interface RouletteSpinResponse {
  pocket: number;
  color: 'vermelho' | 'preto' | 'verde';
  win: boolean;
  totalReturn: number;
  amount: number;
  newBalance: number;
  history: RouletteHistory;
}

export function fetchRouletteConfig(): Promise<RouletteConfig> {
  return apiRequest<RouletteConfig>('/games/roleta/config');
}

export function spinRoulette(bet: RouletteBet, amount: number): Promise<RouletteSpinResponse> {
  return apiRequest<RouletteSpinResponse>('/games/roleta/girar', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, bet, amount },
  });
}

export function fetchRouletteHistory(): Promise<RouletteHistory> {
  return apiRequest<RouletteHistory>('/games/roleta/historico');
}
