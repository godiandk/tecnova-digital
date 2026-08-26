import { apiRequest, MOCK_USER_ID } from './client';

export type TrucoSuit = 'ouros' | 'espadas' | 'copas' | 'paus';
export type TrucoRank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface TrucoCard {
  rank: TrucoRank;
  suit: TrucoSuit;
}

export interface TrucoConfig {
  minBuyIn: number;
  maxBuyIn: number;
  pointsToWinMatch: number;
  trucoHandValue: number;
}

export type RoundResult = 'jogador' | 'bot' | 'empate';

export interface TrucoMatchState {
  buyIn: number;
  playerScore: number;
  botScore: number;
  handValue: number;
  vira: TrucoCard;
  playerHand: TrucoCard[];
  playerCardsPlayed: TrucoCard[];
  botCardsPlayed: TrucoCard[];
  roundResults: RoundResult[];
  pendingTruco: 'jogador' | 'bot' | null;
  finished: boolean;
  matchOutcome?: 'jogador' | 'bot';
  lastEvent?: string;
  newBalance: number;
}

export function fetchTrucoConfig(): Promise<TrucoConfig> {
  return apiRequest<TrucoConfig>('/games/truco/config');
}

export function newTrucoMatch(buyIn: number): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/nova-partida', { method: 'POST', body: { userId: MOCK_USER_ID, buyIn } });
}

export function playTrucoCard(card: TrucoCard): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/jogar-carta', { method: 'POST', body: { userId: MOCK_USER_ID, card } });
}

export function callTruco(): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/pedir-truco', { method: 'POST', body: { userId: MOCK_USER_ID } });
}

export function respondTruco(accept: boolean): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/responder-truco', { method: 'POST', body: { userId: MOCK_USER_ID, accept } });
}
