import { emitWithAck, getSocket } from './socket';

export type Team = 'A' | 'B';
export type BoardEnd = 'esquerda' | 'direita';

export interface Tile {
  a: number;
  b: number;
}

export interface DominoSeatView {
  seatIndex: number;
  userId: string;
  name: string;
  isBot: boolean;
  team: Team;
  tilesInHand: number;
  /** Só vem preenchida pro dono — as dos outros vêm undefined, por design. */
  hand?: Tile[];
  isYou: boolean;
  isPartner: boolean;
}

export interface DominoTableView {
  id: string;
  code: string;
  visibility: 'publica' | 'privada';
  hostUserId: string;
  buyIn: number;
  started: boolean;
  finished: boolean;
  winnerTeam?: Team;
  score: Record<Team, number>;
  board: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  turnSeat: number;
  lastEvent?: string;
  pointsToWin: number;
  /** O servidor já diz se você tem peça jogável — a tela não recalcula a regra. */
  canPlayNow: boolean;
  seats: DominoSeatView[];
}

export interface DominoPublicTable {
  id: string;
  hostName: string;
  seatedCount: number;
  maxSeats: number;
  buyIn: number;
}

export function createDominoTable(visibility: 'publica' | 'privada', buyIn: number): Promise<DominoTableView> {
  return emitWithAck('domino:criar-mesa', { visibility, buyIn });
}

export function listPublicDominoTables(): Promise<DominoPublicTable[]> {
  return emitWithAck('domino:mesas-publicas', {});
}

export function joinDominoByCode(code: string): Promise<DominoTableView> {
  return emitWithAck('domino:entrar-por-codigo', { code });
}

export function joinDominoById(tableId: string): Promise<DominoTableView> {
  return emitWithAck('domino:entrar-por-id', { tableId });
}

export function addDominoBot(tableId: string): Promise<DominoTableView> {
  return emitWithAck('domino:completar-com-bot', { tableId });
}

export function startDominoMatch(tableId: string): Promise<DominoTableView> {
  return emitWithAck('domino:comecar', { tableId });
}

export function playDominoTile(tableId: string, tile: Tile, end: BoardEnd): Promise<DominoTableView> {
  return emitWithAck('domino:jogar-peca', { tableId, tile, end });
}

export function passDominoTurn(tableId: string): Promise<DominoTableView> {
  return emitWithAck('domino:passar', { tableId });
}

export function leaveDominoTable(tableId: string): Promise<DominoTableView | { removed: true }> {
  return emitWithAck('domino:sair', { tableId });
}

export function onDominoTableUpdated(handler: (table: DominoTableView) => void): () => void {
  const socket = getSocket();
  socket.on('domino:mesa-atualizada', handler);
  return () => void socket.off('domino:mesa-atualizada', handler);
}

export function onDominoTableClosed(handler: () => void): () => void {
  const socket = getSocket();
  socket.on('domino:mesa-fechada', handler);
  return () => void socket.off('domino:mesa-fechada', handler);
}
