import { apiRequest } from './client';

export interface NivelDeMesa {
  id: 'bronze' | 'prata' | 'ouro' | 'diamante' | 'rubi' | 'safira';
  nome: string;
  saldoDeEntrada: number;
  minimo: number;
  maximo: number;
  /** As fichas do trilho neste nível, do menor pro maior. A menor é o mínimo da mesa. */
  fichas: number[];
}

export interface MeuNivel {
  saldo: number;
  nivel: NivelDeMesa;
  /** O nível dele e o degrau abaixo — onde ele pode sentar. */
  disponiveis: NivelDeMesa[];
  mesasDeEntrada: Array<{ nivel: string; nome: string; entrada: number; saldoMinimo: number }>;
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
