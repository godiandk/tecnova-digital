import { apiRequest } from './client';

/**
 * A mesa de um jogador só da Banca Francesa.
 *
 * QUATRO ROTAS, e a separação é a regra do jogo: apostar não lança, lançar não aposta.
 * Antes era uma rota só, que confirmava, relançava sozinha até sair um resultado
 * decisivo e pagava — o jogador tocava uma vez e recebia o fim da história. O
 * lançamento nulo, que na mesa de verdade é o momento em que quem apostou decide se
 * continua, acontecia escondido dentro dessa chamada.
 */

/**
 * Os cinco lugares da mesa. `grande` e `pequeno` são o CENTRO do arco; `linha-grande` e
 * `linha-pequeno` são a ficha em cima do traço, que vale metade e arrisca metade. Ases
 * não tem linha: uma aposta que paga 61 por 1 não precisa de versão de risco reduzido.
 */
export type BancaFrancesaBetType = 'ases' | 'pequeno' | 'grande' | 'linha-pequeno' | 'linha-grande';
export type BancaFrancesaOutcome = 'ases' | 'pequeno' | 'grande';
/** O que um lançamento pode dar. `nulo` é a soma que não decide nada. */
export type ResultadoDoLancamento = BancaFrancesaOutcome | 'nulo';

export interface BancaFrancesaBet {
  type: BancaFrancesaBetType;
  amount: number;
}

/** O piso e o teto de uma casa, em fichas, já calculados pro degrau da pessoa. */
export interface LimitesDaCasa {
  minimo: number;
  maximo: number;
}

export interface BancaFrancesaConfig {
  minBet: number;
  maxSimultaneousBets: number;
  betTypes: BancaFrancesaBetType[];
  nomeDaCasa: Record<BancaFrancesaBetType, string>;
  winningSums: Record<BancaFrancesaOutcome, number[]>;
  totalReturnMultiplier: Record<BancaFrancesaOutcome, number>;
  theoreticalRtpByType: Record<BancaFrancesaBetType, number>;
  /** Os limites em MÚLTIPLOS do mínimo — a tela multiplica pelo mínimo do degrau dela. */
  pisoEmMinimos: Record<BancaFrancesaBetType, number>;
  tetoEmMinimos: Record<BancaFrancesaBetType, number>;
  limitesNoNivelDeEntrada: Record<BancaFrancesaBetType, LimitesDaCasa>;
}

/** Um lançamento, com os três dados na ordem em que saem do copo: azul, verde, vermelho. */
export interface LancamentoDaBanca {
  rollId: string;
  dice: [number, number, number];
  sum: number;
  outcome: ResultadoDoLancamento;
  createdAt: string;
}

/**
 * Os estados da rodada. É o servidor que manda: a tela desenha o que ele diz, e nenhum
 * botão aparece habilitado num estado em que ele não faz nada.
 */
export type EstadoDaRodada = 'APOSTAS_ABERTAS' | 'APOSTAS_CONFIRMADAS' | 'LIQUIDADA';

export interface RodadaDaBanca {
  rodadaId: string;
  estado: EstadoDaRodada;
  apostas: BancaFrancesaBet[];
  /** Os lançamentos desta rodada que não decidiram nada. */
  nulos: LancamentoDaBanca[];
  /** O último lançamento saiu nulo e a mesa espera o jogador decidir. */
  esperandoDepoisDoNulo: boolean;
  abertaEm: string;
  totalApostado: number;
  /** Quanto a rodada pode CUSTAR — na linha é metade da ficha. */
  risco: number;
  /** O maior retorno possível. Só um resultado sai, então não é a soma de todos. */
  retornoPossivel: number;
  saldo: number;
  saldoDepoisDaAposta: number;
  minimoDaMesa: number;
  /** O nome do degrau (Bronze, Ouro, Ônix...) e as cinco fichas dele. */
  nomeDoNivel: string;
  fichas: number[];
  limites: Record<BancaFrancesaBetType, LimitesDaCasa>;
}

export interface BetResult extends BancaFrancesaBet {
  won: boolean;
  totalReturn: number;
}

/** O que volta de um lançamento NULO: os dados, e a mesa de volta pro jogador. */
export interface LancamentoNulo {
  decidiu: false;
  lancamento: LancamentoDaBanca;
  rodada: RodadaDaBanca;
  placar: PlacarDaBanca;
}

/** O que volta do lançamento que DECIDE: aí sim o dinheiro se mexeu. */
export interface LancamentoDecisivo {
  decidiu: true;
  lancamento: LancamentoDaBanca;
  results: BetResult[];
  totalStake: number;
  riscoTotal: number;
  totalReturn: number;
  /** Retorno menos o que saiu. Negativo quando a rodada custou mais do que pagou. */
  lucroLiquido: number;
  newBalance: number;
  rodada: RodadaDaBanca;
  placar: PlacarDaBanca;
}

export type ResultadoDoLance = LancamentoNulo | LancamentoDecisivo;

/**
 * O placar DESTA mesa: dados, somas e nulos.
 *
 * Não são as cinco estradas do bacará. O placar antigo traduzia `grande` pra "banca",
 * `pequeno` pra "jogador" e `ases` pra "empate" — e nessa tradução sumiam os dados, a
 * soma e os nulos, que são 153 das 216 combinações.
 */
export interface PlacarDaBanca {
  previous: {
    rollId: string;
    dice: { blue: number; green: number; red: number };
    sum: number;
    outcome: ResultadoDoLancamento;
    createdAt: string;
  } | null;
  history: Array<{
    rollId: string;
    dice: [number, number, number];
    sum: number;
    outcome: ResultadoDoLancamento;
  }>;
  counts: {
    ases: number;
    pequeno: number;
    grande: number;
    nulos: number;
    totalRolls: number;
  };
}

export function fetchBancaFrancesaConfig(): Promise<BancaFrancesaConfig> {
  return apiRequest<BancaFrancesaConfig>('/games/banca-francesa/config');
}

/** O estado autoritativo da rodada. É o que a tela pede ao abrir e ao reconectar. */
export function fetchRodadaDaBanca(): Promise<RodadaDaBanca> {
  return apiRequest<RodadaDaBanca>('/games/banca-francesa/rodada');
}

/** Confirma as apostas. Não custa nada — ficha só sai do saldo quando o dado decide. */
export function confirmarApostas(bets: BancaFrancesaBet[]): Promise<RodadaDaBanca> {
  return apiRequest<RodadaDaBanca>('/games/banca-francesa/apostar', { method: 'POST', body: { bets } });
}

/** Tira as fichas da mesa. De graça. */
export function retirarApostas(): Promise<RodadaDaBanca> {
  return apiRequest<RodadaDaBanca>('/games/banca-francesa/retirar', { method: 'POST', body: {} });
}

/** UM lançamento. Nulo devolve a mesa; decisivo liquida. */
export function lancarDados(actionId?: string): Promise<ResultadoDoLance> {
  return apiRequest<ResultadoDoLance>('/games/banca-francesa/lancar', {
    method: 'POST',
    body: {},
    actionId,
  });
}

export function fetchPlacarDaBanca(): Promise<PlacarDaBanca> {
  return apiRequest<PlacarDaBanca>('/games/banca-francesa/placar');
}
