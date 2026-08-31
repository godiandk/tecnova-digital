import { apiRequest } from './client';
import { Roadmap } from './roadmap';

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
  roadmap: Roadmap;
}

export function fetchBancaFrancesaConfig(): Promise<BancaFrancesaConfig> {
  return apiRequest<BancaFrancesaConfig>('/games/banca-francesa/config');
}

export function playBancaFrancesaRound(bets: BancaFrancesaBet[], actionId?: string): Promise<BancaFrancesaRoundResponse> {
  return apiRequest<BancaFrancesaRoundResponse>('/games/banca-francesa/apostar', {
    method: 'POST',
    body: { bets },
    actionId,
  });
}

export function fetchBancaFrancesaRoadmap(): Promise<Roadmap> {
  return apiRequest<Roadmap>('/games/banca-francesa/placar');
}
