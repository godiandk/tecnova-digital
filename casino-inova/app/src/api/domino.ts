import { apiRequest } from './client';

export interface DominoTile {
  a: number;
  b: number;
}

export type DominoEnd = 'esquerda' | 'direita';

export interface DominoConfig {
  minBuyIn: number;
  maxBuyIn: number;
  handSize: number;
}

export interface DominoMatchState {
  buyIn: number;
  playerHand: DominoTile[];
  boardTiles: DominoTile[];
  leftEnd: number | null;
  rightEnd: number | null;
  botTileCount: number;
  canPlay: boolean;
  /**
   * Quando é você quem abre, é com esta peça — quem tem a maior dupla abre, e é
   * obrigado a abrir com ela. Vem só na primeira jogada da partida.
   */
  aberturaObrigatoria?: DominoTile;
  finished: boolean;
  matchOutcome?: 'jogador' | 'bot' | 'empate';
  lastEvent?: string;
  newBalance: number;
}

export function fetchDominoConfig(): Promise<DominoConfig> {
  return apiRequest<DominoConfig>('/games/domino/config');
}

export function newDominoMatch(buyIn: number): Promise<DominoMatchState> {
  return apiRequest<DominoMatchState>('/games/domino/nova-partida', { method: 'POST', body: { buyIn } });
}

export function playDominoTile(tile: DominoTile, end?: DominoEnd): Promise<DominoMatchState> {
  return apiRequest<DominoMatchState>('/games/domino/jogar-peca', { method: 'POST', body: { tile, end } });
}

export function passDominoTurn(): Promise<DominoMatchState> {
  return apiRequest<DominoMatchState>('/games/domino/passar', { method: 'POST', body: {} });
}
