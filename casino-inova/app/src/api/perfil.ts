import { apiRequest } from './client';

export interface PerfilDoServidor {
  id: string;
  /** Oito dígitos. A tela mostra como 0000-0000; o servidor guarda cru. */
  publicCode: string;
  avatar: string | null;
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  role: 'jogador' | 'moderador' | 'admin';
}

/** Os retratos que existem, ditos pelo servidor. */
export function fetchAvatares(): Promise<string[]> {
  return apiRequest<string[]>('/users/avatares');
}

export function atualizarPerfil(dados: { name?: string; avatar?: string }): Promise<PerfilDoServidor> {
  return apiRequest<PerfilDoServidor>('/users/me', { method: 'PATCH', body: dados });
}

/** 12345678 -> "1234-5678". Só pra mostrar; o que vai pro servidor são os dígitos. */
export function formatarCodigo(codigo: string | undefined): string {
  const limpo = (codigo ?? '').replace(/\D/g, '');
  return limpo.length === 8 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : '—';
}
