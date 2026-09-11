import { apiRequest } from './client';

export interface CasaDoCalendario {
  dia: number;
  premio: number;
  /** Dia de semana fechada (7, 14, 21) ou o último do mês — a tela desenha maior. */
  marco: boolean;
}

export interface CalendarioDeRecompensa {
  dias: CasaDoCalendario[];
  /** A casa que está pra ser coletada agora. */
  diaAtual: number;
  podeColetar: boolean;
  /** Quando o próximo dia abre, em `AAAA-MM-DD` (UTC). */
  proximaAbertura: string;
  sequenciaPerdida: boolean;
  /**
   * Dias seguidos de verdade — atravessa a virada do mês.
   *
   * É um número DIFERENTE de `diaAtual`: quem fecha uma grade de 31 volta pra casa 1 com a
   * sequência intacta. A tela mostra os dois, porque mostrar só a casa faria parecer que a
   * sequência zerou.
   */
  diasSeguidos: number;
  premioDeHoje: number;
  /** Quantas casas a grade deste mês tem: 28, 29, 30 ou 31. */
  totalDeDias: number;
  /** Que dia do mês é hoje, no fuso do jogo. */
  diaDoMes: number;
  nivel: number;
  bonusDeNivel: number;
  /** O dia do servidor, em UTC. É com ele que a tela explica quando o dia vira. */
  hoje: string;
}

export interface ColetaFeita {
  dia: number;
  premio: number;
  diasSeguidos: number;
  nivel: number;
  bonusDeNivel: number;
  claimId: string;
  /** Esta resposta é a repetição de uma coleta que já tinha acontecido. */
  repetida: boolean;
  novoSaldo: number;
  calendario: CalendarioDeRecompensa;
}

export interface ColetaDoHistorico {
  claimId: string;
  dia: string;
  casaDoCalendario: number;
  diasSeguidos: number;
  nivel: number;
  multiplicadorDoDia: number;
  bonusDeNivel: number;
  premio: number;
}

export function fetchCalendarioDeRecompensa(): Promise<CalendarioDeRecompensa> {
  return apiRequest<CalendarioDeRecompensa>('/recompensas/diaria');
}

/**
 * Coleta o prêmio de hoje.
 *
 * `claimId` identifica a INTENÇÃO, não o pedido: se a rede cair depois de o servidor ter
 * pago, o retry com a MESMA chave devolve o mesmo prêmio em vez de "você já coletou". Por
 * isso ele é sorteado uma vez por dia e guardado enquanto a tela vive — sortear a cada
 * toque transformaria o segundo toque numa coleta diferente, que o servidor recusaria.
 */
export function coletarRecompensa(claimId: string): Promise<ColetaFeita> {
  return apiRequest<ColetaFeita>('/recompensas/diaria/coletar', { method: 'POST', body: { claimId } });
}

export function fetchHistoricoDeRecompensa(limite = 60): Promise<ColetaDoHistorico[]> {
  return apiRequest<ColetaDoHistorico[]>(`/recompensas/diaria/historico?limite=${limite}`);
}
