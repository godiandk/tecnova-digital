import { apiRequest } from './client';
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
  | 'duzia3'
  /** As três casas "2:1" no fim de cada fileira: a coluna daquela fileira. */
  | 'coluna1'
  | 'coluna2'
  | 'coluna3';

export interface RouletteBet {
  type: RouletteBetType;
  number?: number;
}

/** Uma aposta com o valor dela — é assim que ela vai pro servidor. */
export interface ApostaDaRoleta extends RouletteBet {
  amount: number;
}

/** O que aconteceu com uma aposta depois que a bola parou. */
export interface ResultadoDaAposta extends ApostaDaRoleta {
  won: boolean;
  totalReturn: number;
}

export interface RouletteConfig {
  minBet: number;
  redNumbers: number[];
  totalMultiplier: Record<RouletteBetType, number>;
  theoreticalRtp: number;
}

export interface RouletteSpinResponse {
  pocket: number;
  color: 'vermelho' | 'preto' | 'verde';
  /** Uma linha por aposta, na ordem em que foram mandadas. */
  results: ResultadoDaAposta[];
  win: boolean;
  totalStake: number;
  totalReturn: number;
  newBalance: number;
  history: RouletteHistory;
}

export function fetchRouletteConfig(): Promise<RouletteConfig> {
  return apiRequest<RouletteConfig>('/games/roleta/config');
}

/**
 * Roda a bola com TODAS as apostas da rodada.
 *
 * Era uma aposta por giro, e isso não é roleta: na mesa se põe ficha em quantas casas
 * quiser antes de a bola correr. "Uma no 17 e uma no vermelho" precisava de dois giros —
 * dois resultados diferentes pra uma jogada que na mesa é uma só.
 */
export function spinRoulette(bets: ApostaDaRoleta[], actionId?: string): Promise<RouletteSpinResponse> {
  return apiRequest<RouletteSpinResponse>('/games/roleta/girar', {
    method: 'POST',
    body: { bets },
    actionId,
  });
}

export function fetchRouletteHistory(): Promise<RouletteHistory> {
  return apiRequest<RouletteHistory>('/games/roleta/historico');
}
