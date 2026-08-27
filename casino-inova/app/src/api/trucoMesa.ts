import { emitWithAck, getSocket } from './socket';
import { TrucoCard, TrucoStyle, TrucoVariant } from './truco';

export type Team = 'A' | 'B';
export type RaiseResponse = 'aceitar' | 'correr' | 'aumentar';

export interface TrucoSeatView {
  seatIndex: number;
  userId: string;
  name: string;
  isBot: boolean;
  team: Team;
  cardsInHand: number;
  /** Só vem preenchida pro dono da mão — os outros vêm undefined, por design. */
  hand?: TrucoCard[];
  isYou: boolean;
  isPartner: boolean;
}

export interface TrucoTableView {
  id: string;
  code: string;
  visibility: 'publica' | 'privada';
  variant: TrucoVariant;
  style: TrucoStyle;
  hostUserId: string;
  buyIn: number;
  started: boolean;
  finished: boolean;
  winnerTeam?: Team;
  score: Record<Team, number>;
  handValue: number;
  pendingRaise: { toValue: number; byTeam: Team } | null;
  nextRaiseValue: number | null;
  vira: TrucoCard | null;
  turnSeat: number;
  currentTrick: { seatIndex: number; card: TrucoCard }[];
  roundResults: ('jogador' | 'bot' | 'empate')[];
  lastEvent?: string;
  pointsToWin: number;
  seats: TrucoSeatView[];
}

export interface TrucoPublicTable {
  id: string;
  hostName: string;
  seatedCount: number;
  maxSeats: number;
  variant: TrucoVariant;
  style: TrucoStyle;
  buyIn: number;
}

export interface ReceivedSignal {
  signal: { id: string; label: string; gesture: string; iconIndex: number };
  fromName: string;
}

export function createTrucoTable(options: {
  visibility: 'publica' | 'privada';
  variant: TrucoVariant;
  style: TrucoStyle;
  buyIn: number;
}): Promise<TrucoTableView> {
  return emitWithAck('truco:criar-mesa', { ...options });
}

export function listPublicTrucoTables(): Promise<TrucoPublicTable[]> {
  return emitWithAck('truco:mesas-publicas', {});
}

export function joinTrucoByCode(code: string): Promise<TrucoTableView> {
  return emitWithAck('truco:entrar-por-codigo', { code });
}

export function joinTrucoById(tableId: string): Promise<TrucoTableView> {
  return emitWithAck('truco:entrar-por-id', { tableId });
}

export function addTrucoBot(tableId: string): Promise<TrucoTableView> {
  return emitWithAck('truco:completar-com-bot', { tableId });
}

export function startTrucoMatch(tableId: string): Promise<TrucoTableView> {
  return emitWithAck('truco:comecar', { tableId });
}

export function playTrucoTableCard(tableId: string, card: TrucoCard): Promise<TrucoTableView> {
  return emitWithAck('truco:jogar-carta', { tableId, card });
}

export function callTrucoRaise(tableId: string): Promise<TrucoTableView> {
  return emitWithAck('truco:pedir', { tableId });
}

export function respondTrucoRaise(tableId: string, response: RaiseResponse): Promise<TrucoTableView> {
  return emitWithAck('truco:responder', { tableId, response });
}

export function sendTableSignal(tableId: string, signalId: string): Promise<{ enviado: boolean }> {
  return emitWithAck('truco:sinal', { tableId, signalId });
}

export function leaveTrucoTable(tableId: string): Promise<TrucoTableView | { removed: true }> {
  return emitWithAck('truco:sair', { tableId });
}

export function onTrucoTableUpdated(handler: (table: TrucoTableView) => void): () => void {
  const socket = getSocket();
  socket.on('truco:mesa-atualizada', handler);
  return () => void socket.off('truco:mesa-atualizada', handler);
}

export function onTrucoTableClosed(handler: () => void): () => void {
  const socket = getSocket();
  socket.on('truco:mesa-fechada', handler);
  return () => void socket.off('truco:mesa-fechada', handler);
}

/** O sinal do parceiro chega só pra você — o adversário nunca recebe este evento. */
export function onSignalReceived(handler: (payload: ReceivedSignal) => void): () => void {
  const socket = getSocket();
  socket.on('truco:sinal-recebido', handler);
  return () => void socket.off('truco:sinal-recebido', handler);
}
