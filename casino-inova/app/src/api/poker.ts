import { apiRequest, MOCK_USER_ID } from './client';

export type PokerSuit = 'ouros' | 'espadas' | 'copas' | 'paus';

export interface PokerCard {
  rank: number;
  suit: PokerSuit;
}

export type PokerAction = 'desistir' | 'passar' | 'pagar' | 'aumentar';
export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerConfig {
  minBuyIn: number;
  maxBuyIn: number;
  smallBlind: number;
  bigBlind: number;
  smallBet: number;
  bigBet: number;
}

export interface PokerOutcome {
  winner: 'jogador' | 'bot' | 'empate';
  potWon: number;
  playerHandLabel?: string;
  botHandLabel?: string;
  playerHole: PokerCard[];
  botHole: PokerCard[];
}

export interface PokerHandState {
  buyIn: number;
  playerStack: number;
  botStack: number;
  pot: number;
  playerHole: PokerCard[];
  board: PokerCard[];
  street: PokerStreet;
  playerBetThisStreet: number;
  botBetThisStreet: number;
  toAct: 'jogador' | 'bot';
  legalActions: PokerAction[];
  finished: boolean;
  outcome?: PokerOutcome;
  lastEvent?: string;
  newBalance: number;
}

export function fetchPokerConfig(): Promise<PokerConfig> {
  return apiRequest<PokerConfig>('/games/poker/config');
}

export function newPokerHand(buyIn: number): Promise<PokerHandState> {
  return apiRequest<PokerHandState>('/games/poker/nova-mao', { method: 'POST', body: { userId: MOCK_USER_ID, buyIn } });
}

export function actPoker(action: PokerAction): Promise<PokerHandState> {
  return apiRequest<PokerHandState>('/games/poker/agir', { method: 'POST', body: { userId: MOCK_USER_ID, action } });
}
