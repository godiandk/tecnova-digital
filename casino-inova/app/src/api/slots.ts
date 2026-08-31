import { apiRequest } from './client';

export interface SlotSymbolDto {
  id: string;
  label: string;
  weight: number;
  /** Multiplicador por quantos símbolos iguais saíram seguidos, a partir do rolo 1. */
  payout: { 3: number; 4: number; 5: number };
}

export interface PaylineDto {
  name: string;
  /** Uma célula por rolo, na ordem dos rolos. */
  cells: number[];
}

export interface SlotsConfig {
  symbols: SlotSymbolDto[];
  /** Formato da grade vem do servidor — a tela não guarda cópia própria. */
  reels: number;
  rows: number;
  paylines: PaylineDto[];
  minMatch: number;
  minBet: number;
  maxBet: number;
  theoreticalRtp: number;
}

export interface WinningLineDto {
  payline: string;
  symbolId: string;
  matched: number;
  /** As células que formaram a combinação — já vêm prontas do servidor. */
  cells: number[];
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

export function spinSlots(bet: number, actionId?: string): Promise<SpinResponse> {
  return apiRequest<SpinResponse>('/games/slots/girar', { method: 'POST', body: { bet }, actionId });
}
