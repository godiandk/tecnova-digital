import { apiRequest } from './client';

export interface GanhoRecente {
  jogador: string;
  jogo: string;
  /** Ganho líquido — o prêmio já vem com a aposta descontada pelo servidor. */
  valor: number;
  quando: string;
}

export function ganhosRecentes(): Promise<GanhoRecente[]> {
  return apiRequest<GanhoRecente[]>('/lobby/ganhos-recentes');
}
