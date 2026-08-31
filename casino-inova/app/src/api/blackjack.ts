import { apiRequest } from './client';

export interface BlackjackConfig {
  minBet: number;
  maxBet: number;
  blackjackPayoutMultiplier: number;
  dealerStandsOn: number;
  maxHands: number;
  insurancePayoutMultiplier: number;
  insuranceMaxFraction: number;
  baralhos: number;
}

export type BlackjackOutcome = 'jogador-ganhou' | 'dealer-ganhou' | 'empate';

/** Uma das mãos do jogador. Sem dividir é sempre uma só; dividindo chegam a quatro. */
export interface MaoDeBlackjack {
  cartas: string[];
  total: number;
  /** Tem Ás valendo 11 — a mão não estoura na próxima carta. */
  mole: boolean;
  aposta: number;
  dobrada: boolean;
  deSplit: boolean;
  /** 21 nas duas primeiras cartas da mão original. Depois de dividir nunca é. */
  blackjack: boolean;
  estourou: boolean;
  /** É esta que está sendo jogada agora. */
  emJogo: boolean;
  outcome?: BlackjackOutcome;
  totalReturn?: number;
}

export interface BlackjackHandResponse {
  maos: MaoDeBlackjack[];
  maoAtual: number;
  /** Segunda carta do dealer vem `null` enquanto a mão está em andamento. */
  cartasDoDealer: (string | null)[];
  totalDoDealer?: number;
  /** O que dá pra fazer agora — quem manda nos botões é o servidor. */
  podeComprar: boolean;
  podeParar: boolean;
  podeDobrar: boolean;
  podeDividir: boolean;
  esperandoSeguro: boolean;
  seguroMaximo: number;
  seguro: number;
  seguroPago: number;
  apostaInicial: number;
  finished: boolean;
  /** A sapata foi embaralhada antes desta mão. */
  embaralhouAgora: boolean;
  cartasAteOCorte: number;
  newBalance: number;
}

export function fetchBlackjackConfig(): Promise<BlackjackConfig> {
  return apiRequest<BlackjackConfig>('/games/blackjack/config');
}

export function startBlackjackHand(bet: number): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/apostar', { method: 'POST', body: { bet } });
}

export function hitBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/pedir-carta', { method: 'POST', body: {} });
}

export function standBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/parar', { method: 'POST', body: {} });
}

export function doubleBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/dobrar', { method: 'POST', body: {} });
}

export function splitBlackjack(): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/dividir', { method: 'POST', body: {} });
}

/** Recusar é seguir o jogo — e, na matemática da mesa, quase sempre é o certo. */
export function insureBlackjack(aceitar: boolean, valor?: number): Promise<BlackjackHandResponse> {
  return apiRequest<BlackjackHandResponse>('/games/blackjack/seguro', { method: 'POST', body: { aceitar, valor } });
}
