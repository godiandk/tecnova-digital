import { apiRequest } from './client';

export interface NivelDeMesa {
  /*
   * Texto livre e não uma união de nomes: a escada é GERADA no servidor, e travar num
   * conjunto fixo aqui traria de volta o defeito que a geração resolveu — a lista
   * acabaria no último nome escrito. Eram seis nomes; hoje são doze.
   */
  id: string;
  nome: string;
  saldoDeEntrada: number;
  minimo: number;
  maximo: number;
  /** As fichas do trilho neste nível, do menor pro maior. A menor é o mínimo da mesa. */
  fichas: number[];
  /**
   * O nível de jogador que abre este degrau. Vem do servidor junto com a escada.
   *
   * Existe porque o degrau não é mais só uma questão de saldo: comprar fichas dá mais
   * rodadas na mesa da pessoa, não passagem pra mesa de cima. Sem este número a tela
   * mostraria mesas caras sem nenhuma pista de como se chega lá.
   */
  abreNoLevel: number | null;
}

export interface MeuNivel {
  saldo: number;
  /** O nível do JOGADOR (a barra de XP), não o degrau de mesa. */
  level: number;
  /** O degrau econômico: `min(o que o saldo banca, o que o nível liberou)`. */
  nivel: NivelDeMesa;
  /** O degrau dele e o logo abaixo — onde ele pode sentar. */
  disponiveis: NivelDeMesa[];
  mesasDeEntrada: Array<{ nivel: string; nome: string; entrada: number; saldoMinimo: number }>;
  /** O nível está segurando uma mesa que o saldo já bancaria? */
  travadoPeloNivel: boolean;
  /** Qual mesa, e em que nível ela abre. Nulo quando nada está travado. */
  proximaPorNivel: { nivel: NivelDeMesa; abreNoLevel: number | null } | null;
}

/**
 * Em que mesa esta pessoa joga, e quanto ela pode apostar.
 *
 * A CONTA É DO SERVIDOR, e não daqui, por dois motivos. O saldo mora lá: um limite
 * calculado em cima do saldo que a tela tem pode aceitar uma aposta que o servidor vai
 * recusar, e a pessoa leva um erro depois de montar a aposta inteira. E limite é REGRA —
 * regra que o cliente calcula é regra que o cliente muda.
 */
export function fetchMeuNivel(): Promise<MeuNivel> {
  return apiRequest<MeuNivel>('/niveis/meu');
}

/** A escada inteira, pra mostrar o que vem depois. Não depende de quem pede. */
export function fetchEscadaDeNiveis(): Promise<NivelDeMesa[]> {
  return apiRequest<NivelDeMesa[]>('/niveis/escada');
}
