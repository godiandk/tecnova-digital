import { apiRequest } from './client';

export type Moeda = 'BRL' | 'USD' | 'EUR';

export interface PacoteDeFichas {
  id: string;
  /** Quantas fichas entram na carteira, já com bônus de nível e de promoção. */
  chips: number;
  /**
   * Quantas apostas mínimas isso compra NA MESA DESTA PESSOA.
   *
   * É o número que diz se o pacote significa alguma coisa: "120 mil fichas" não diz nada
   * sozinho — numa mesa de mínimo 50 é uma banca inteira, numa de mínimo 500 mil é troco.
   */
  apostasMinimas: number;
  moeda: Moeda;
  precoEmCentavos: number;
  precoEscrito: string;
  degrau: { id: string; nome: string; minimo: number };
  bonusDeNivel: number;
  bonusDePromocao: number;
  promocao?: { id: string; nome: string; bonusPercent: number; terminaEm: string };
}

export interface CompraDoHistorico {
  pacote: string;
  chips: number;
  degrau: string | null;
  nivel: number | null;
  promocao: string | null;
  bonusPercent: number | null;
  preco: string | null;
  porta: string | null;
  estornada: boolean;
  em: string;
}

/**
 * A loja DESTA pessoa: os mesmos quatro preços, com o pacote do degrau e do nível dela.
 *
 * A CONTA É DO SERVIDOR. O tamanho do pacote depende do degrau econômico e do nível, e os
 * dois moram lá — um pacote calculado aqui mostraria um número que a compra não entrega.
 */
export function fetchMinhaLoja(moeda: Moeda = 'BRL'): Promise<PacoteDeFichas[]> {
  return apiRequest<PacoteDeFichas[]>(`/store/minha?moeda=${moeda}`);
}

/** A vitrine pública (a do Bronze), para antes de a sessão carregar. */
export function fetchVitrine(moeda: Moeda = 'BRL'): Promise<PacoteDeFichas[]> {
  return apiRequest<PacoteDeFichas[]>(`/store/pacotes?moeda=${moeda}`);
}

export function fetchMinhasCompras(): Promise<CompraDoHistorico[]> {
  return apiRequest<CompraDoHistorico[]>('/store/minhas-compras');
}
