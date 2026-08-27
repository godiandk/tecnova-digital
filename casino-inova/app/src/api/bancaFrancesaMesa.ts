import { emitWithAck, getSocket } from './socket';
import { BancaFrancesaBet, BancaFrancesaOutcome, BetResult } from './bancaFrancesa';
import { PlayerColor } from '../data/chipImages';

export interface TableSeatView {
  userId: string;
  name: string;
  isBot: boolean;
  color: PlayerColor;
  pendingBets: BancaFrancesaBet[];
  balance?: number;
}

export interface TableRoundView {
  dice: number[];
  sum: number;
  outcome: BancaFrancesaOutcome;
  bySeat: Record<string, { results: BetResult[]; totalStake: number; totalReturn: number }>;
  at: string;
}

export interface TableView {
  id: string;
  code: string;
  visibility: 'publica' | 'privada';
  hostUserId: string;
  seats: TableSeatView[];
  lastRound?: TableRoundView;
}

export interface PublicTableSummary {
  id: string;
  hostName: string;
  seatedCount: number;
  maxSeats: number;
}

export function createTable(visibility: 'publica' | 'privada'): Promise<TableView> {
  return emitWithAck('banca-francesa:criar-mesa', { visibility });
}

export function listPublicTables(): Promise<PublicTableSummary[]> {
  return emitWithAck('banca-francesa:mesas-publicas', {});
}

export function joinByCode(code: string): Promise<TableView> {
  return emitWithAck('banca-francesa:entrar-por-codigo', { code });
}

export function joinById(tableId: string): Promise<TableView> {
  return emitWithAck('banca-francesa:entrar-por-id', { tableId });
}

export function inviteFriend(tableId: string, friendUserId: string): Promise<{ enviado: boolean; motivo?: string; amigoOnline?: boolean }> {
  return emitWithAck('banca-francesa:convidar-amigo', { tableId, friendUserId });
}

export function addBot(tableId: string): Promise<TableView> {
  return emitWithAck('banca-francesa:completar-com-bot', { tableId });
}

export function placeBets(tableId: string, bets: BancaFrancesaBet[]): Promise<TableView> {
  return emitWithAck('banca-francesa:apostar', { tableId, bets });
}

export function roll(tableId: string): Promise<TableView> {
  return emitWithAck('banca-francesa:girar', { tableId });
}

export function leaveTable(tableId: string): Promise<TableView | { removed: true }> {
  return emitWithAck('banca-francesa:sair', { tableId });
}

/** Cada `on*` devolve a função de cancelar — chame no cleanup do useEffect. */
export function onTableUpdated(handler: (table: TableView) => void): () => void {
  const socket = getSocket();
  socket.on('banca-francesa:mesa-atualizada', handler);
  return () => void socket.off('banca-francesa:mesa-atualizada', handler);
}

export function onTableClosed(handler: () => void): () => void {
  const socket = getSocket();
  socket.on('banca-francesa:mesa-fechada', handler);
  return () => void socket.off('banca-francesa:mesa-fechada', handler);
}

export function onInviteReceived(handler: (invite: { fromUserId: string; tableId: string }) => void): () => void {
  const socket = getSocket();
  socket.on('banca-francesa:convite-recebido', handler);
  return () => void socket.off('banca-francesa:convite-recebido', handler);
}
