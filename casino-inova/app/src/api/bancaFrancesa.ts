import { apiRequest, MOCK_USER_ID } from './client';

export interface NumberBet {
  number: number;
  amount: number;
}

export interface BancaFrancesaConfig {
  minBet: number;
  maxBet: number;
  maxSimultaneousNumbers: number;
  totalMultiplierByMatches: Record<string, number>;
  theoreticalRtp: number;
}

export interface BetResult extends NumberBet {
  matches: number;
  totalReturn: number;
}

export interface BancaFrancesaRoundResponse {
  dice: number[];
  results: BetResult[];
  totalStake: number;
  totalReturn: number;
  newBalance: number;
}

export function fetchBancaFrancesaConfig(): Promise<BancaFrancesaConfig> {
  return apiRequest<BancaFrancesaConfig>('/games/banca-francesa/config');
}

export function playBancaFrancesaRound(bets: NumberBet[]): Promise<BancaFrancesaRoundResponse> {
  return apiRequest<BancaFrancesaRoundResponse>('/games/banca-francesa/apostar', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, bets },
  });
}
