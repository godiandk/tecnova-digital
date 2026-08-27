import { apiRequest } from './client';

export interface BlackjackConfig {
  minBet: number;
  maxBet: number;
  blackjackPayoutMultiplier: number;
  dealerStandsOn: number;
}

export type BlackjackOutcome = 'jogador-ganhou' | 'dealer-ganhou' | 'empate';

export interface BlackjackHandResponse {
  playerCards: string[];
  playerTotal: number;
  /** Segunda carta do dealer vem `null` enquanto a mão está em andamento. */
  dealerCards: (string | null)[];
  dealerTotal?: number;
  bet: number;
  finished: boolean;
  outcome?: BlackjackOutcome;
  totalReturn?: number;
  newBalance: number;
}

export function fetchBlackjackConfig(): Promise<BlackjackConfig> {
  return apiRequest<BlackjackConfig>('/games/blackjack/config');
}

export function startBlackjackHand(bet: number): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/apostar', { method: 'POST', body: { bet } });
}

export function hitBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/pedir-carta', { method: 'POST', body: {} });
}

export function standBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/parar', { method: 'POST', body: {} });
}
