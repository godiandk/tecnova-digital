import { apiRequest } from './client';
import { Roadmap } from './roadmap';

export type BacBoBetType = 'jogador' | 'banca' | 'empate';

export interface BacBoBet {
  type: BacBoBetType;
  amount: number;
}

export interface BacBoConfig {
  minBet: number;
  maxBet: number;
  betTypes: BacBoBetType[];
  sideTotalMultiplier: number;
  tieRefundMultiplier: number;
  /** Prêmio do empate por total dos dados: {"2": 88, "3": 25, ...}. */
  tieProfitOdds: Record<string, number>;
  theoreticalRtpByType: Record<BacBoBetType, number>;
}

export interface BacBoBetResult extends BacBoBet {
  won: boolean;
  totalReturn: number;
}

export interface BacBoRoundResponse {
  playerDice: number[];
  bankerDice: number[];
  playerTotal: number;
  bankerTotal: number;
  outcome: BacBoBetType;
  results: BacBoBetResult[];
  totalStake: number;
  totalReturn: number;
  newBalance: number;
  roadmap: Roadmap;
}

export function fetchBacBoConfig(): Promise<BacBoConfig> {
  return apiRequest<BacBoConfig>('/games/bac-bo/config');
}

export function fetchBacBoRoadmap(): Promise<Roadmap> {
  return apiRequest<Roadmap>('/games/bac-bo/placar');
}

export function playBacBoRound(bets: BacBoBet[], actionId?: string): Promise<BacBoRoundResponse> {
  return apiRequest<BacBoRoundResponse>('/games/bac-bo/apostar', {
    method: 'POST',
    body: { bets },
    actionId,
  });
}
