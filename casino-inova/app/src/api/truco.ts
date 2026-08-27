import { apiRequest, MOCK_USER_ID } from './client';

export type TrucoSuit = 'ouros' | 'espadas' | 'copas' | 'paus';
export type TrucoRank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface TrucoCard {
  rank: TrucoRank;
  suit: TrucoSuit;
}

export type TrucoVariant = 'paulista' | 'mineiro';
/** "sujo" permite sinal pro parceiro; "limpo" proíbe. */
export type TrucoStyle = 'sujo' | 'limpo';

export interface TrucoVariantRules {
  hasVira: boolean;
  baseHandValue: number;
  handValueLadder: number[];
  raiseLabel: Record<string, string>;
  pointsToWinMatch: number;
  ironHandAt: number;
}

export interface TrucoSignal {
  id: string;
  label: string;
  gesture: string;
  iconIndex: number;
}

export interface TrucoConfig {
  minBuyIn: number;
  maxBuyIn: number;
  variants: Record<TrucoVariant, TrucoVariantRules>;
  defaultVariant: TrucoVariant;
  styles: TrucoStyle[];
  defaultStyle: TrucoStyle;
  mineiroFixedManilhas: { card: TrucoCard; nickname: string }[];
  signals: TrucoSignal[];
}

export type TrucoResponse = 'aceitar' | 'correr' | 'aumentar';

export type RoundResult = 'jogador' | 'bot' | 'empate';

export interface TrucoMatchState {
  buyIn: number;
  playerScore: number;
  botScore: number;
  variant: TrucoVariant;
  style: TrucoStyle;
  pointsToWinMatch: number;
  handValue: number;
  /** Valor que o pedido em aberto quer alcançar (null = nenhum pedido pendente). */
  pendingHandValue: number | null;
  /** Quanto você pode pedir agora (null = não pode aumentar nesse momento). */
  nextRaiseValue: number | null;
  /** Null no mineiro, que não tem vira — as manilhas lá são fixas. */
  vira: TrucoCard | null;
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

export function newTrucoMatch(buyIn: number, variant: TrucoVariant = 'paulista', style: TrucoStyle = 'sujo'): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/nova-partida', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, buyIn, variant, style },
  });
}

export function sendTrucoSignal(signalId: string): Promise<unknown> {
  return apiRequest('/games/truco/sinal', { method: 'POST', body: { userId: MOCK_USER_ID, signalId } });
}

export function playTrucoCard(card: TrucoCard): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/jogar-carta', { method: 'POST', body: { userId: MOCK_USER_ID, card } });
}

export function callTruco(): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/pedir-truco', { method: 'POST', body: { userId: MOCK_USER_ID } });
}

export function respondTruco(response: TrucoResponse): Promise<TrucoMatchState> {
  return apiRequest<TrucoMatchState>('/games/truco/responder-truco', { method: 'POST', body: { userId: MOCK_USER_ID, response } });
}
