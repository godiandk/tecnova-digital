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
  /** Quantas vezes os dados voltaram pro copo antes de sair soma que decide. */
  rerolls: number;
  /**
   * Os lançamentos que não decidiram nada, na ordem em que saíram (até 3 guardados).
   *
   * É com eles que a tela LANÇA a hesitação em vez de só escrever que ela houve: cada
   * um é jogado na tigela de verdade, com os dados que saíram de verdade.
   */
  lancamentosNulos: number[][];
  bySeat: Record<string, { results: BetResult[]; totalStake: number; totalReturn: number }>;
  at: string;
}

/**
 * Um lançamento dos três dados, já julgado pelo servidor.
 *
 * `outcome` nulo é o LANÇAMENTO NULO: a soma não decide nada (4, 8 a 13, 17, 18), as
 * apostas ficam em pé e a mesa reabre a janela pra quem quiser mexer nelas.
 */
export interface LancamentoView {
  dice: number[];
  sum: number;
  outcome: BancaFrancesaOutcome | null;
}

/**
 * A rodada que está acontecendo AGORA — diferente de `lastRound`, que é a que acabou.
 *
 * É o que deixa a tela mostrar o nulo enquanto ele importa, e não só no resumo do fim:
 * quem senta no meio de uma sequência de nulos vê os dados que já saíram e entende por
 * que a mesa está esperando.
 */
export interface RodadaEmAndamentoView {
  rodadaId: string;
  lancamentos: LancamentoView[];
  /** As apostas reabriram porque o dado não decidiu — é a hora de aumentar ou desistir. */
  esperandoDepoisDeNulo: boolean;
}

/**
 * A fase da mesa, dita pelo servidor.
 *
 * `terminaEm` é um INSTANTE ABSOLUTO (milissegundos), não uma contagem que chega de
 * segundo em segundo pela rede: a tela anima o relógio sozinha a partir dele e continua
 * certa mesmo perdendo mensagem. E chegar a zero aqui não fecha nada — quem lança o
 * dado é o servidor.
 */
export interface FaseView {
  rodadaId: string;
  fase: string;
  terminaEm: number | null;
  versao: number;
  seq: number;
}

export interface TableView {
  id: string;
  code: string;
  visibility: 'publica' | 'privada';
  hostUserId: string;
  seats: TableSeatView[];
  lastRound?: TableRoundView;
  rodada?: RodadaEmAndamentoView;
  fase?: FaseView;
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

/**
 * Tira as fichas da mesa antes do lance.
 *
 * Não custa nada: nesta mesa a ficha só sai do saldo quando o dado decide, então quem
 * desiste no meio de uma sequência de nulos sai com o saldo com que entrou.
 */
export function withdrawBets(tableId: string): Promise<TableView> {
  return emitWithAck('banca-francesa:retirar', { tableId });
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
