import { apiRequest, MOCK_USER_ID } from './client';

export interface SlotSymbolDto {
  id: string;
  label: string;
  weight: number;
  payout3: number;
}

export interface SlotsConfig {
  symbols: SlotSymbolDto[];
  minBet: number;
  maxBet: number;
  theoreticalRtp: number;
}

export interface WinningLineDto {
  payline: string;
  symbolId: string;
  win: number;
}

export interface SpinResponse {
  grid: string[];
  winningLines: WinningLineDto[];
  totalWin: number;
  bet: number;
  newBalance: number;
}

export function fetchSlotsConfig(): Promise<SlotsConfig> {
  return apiRequest<SlotsConfig>('/games/slots/config');
}

export function spinSlots(bet: number): Promise<SpinResponse> {
  return apiRequest<SpinResponse>('/games/slots/girar', { method: 'POST', body: { userId: MOCK_USER_ID, bet } });
}
