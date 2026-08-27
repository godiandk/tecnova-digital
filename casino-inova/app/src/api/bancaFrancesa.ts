import { apiRequest, MOCK_USER_ID } from './client';

export type BancaFrancesaBetType = 'ases' | 'pequeno' | 'grande' | 'linha';
export type BancaFrancesaOutcome = 'ases' | 'pequeno' | 'grande';

export interface BancaFrancesaBet {
  type: BancaFrancesaBetType;
  amount: number;
}

export interface BancaFrancesaConfig {
  minBet: number;
  maxBet: number;
  maxSimultaneousBets: number;
  betTypes: BancaFrancesaBetType[];
  winningSums: Record<'ases' | 'pequeno' | 'grande', number[]>;
  totalReturnMultiplier: Record<'ases' | 'pequeno' | 'grande', number>;
  theoreticalRtpByType: Record<BancaFrancesaBetType, number>;
}

export interface BetResult extends BancaFrancesaBet {
  won: boolean;
  totalReturn: number;
}

export interface BancaFrancesaRoundResponse {
  dice: number[];
  sum: number;
  outcome: BancaFrancesaOutcome;
  rerolls: number;
  results: BetResult[];
  totalStake: number;
  totalReturn: number;
  newBalance: number;
}

export function fetchBancaFrancesaConfig(): Promise<BancaFrancesaConfig> {
  return apiRequest<BancaFrancesaConfig>('/games/banca-francesa/config');
}

export function playBancaFrancesaRound(bets: BancaFrancesaBet[]): Promise<BancaFrancesaRoundResponse> {
  return apiRequest<BancaFrancesaRoundResponse>('/games/banca-francesa/apostar', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, bets },
  });
}
