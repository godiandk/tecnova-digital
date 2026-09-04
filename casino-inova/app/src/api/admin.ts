import { apiRequest } from './client';
import { PerfilDoServidor } from './perfil';

export interface PessoaAchada {
  usuario: PerfilDoServidor;
  /** Por onde a pessoa entra. Serve pra confirmar que é ela antes de creditar. */
  emails: string[];
  balance: number;
}

/**
 * Procura alguém pelo e-mail, pelo id ou pelo código público.
 *
 * Os três porque cada um aparece numa situação: o e-mail é o que a pessoa diz quando
 * pede ajuda, o código é o que ela lê no próprio perfil, e o id é o que aparece num
 * registro de erro.
 */
export function procurarPessoa(termo: string): Promise<PessoaAchada> {
  return apiRequest<PessoaAchada>(`/admin/usuarios/procurar?termo=${encodeURIComponent(termo)}`);
}

export interface FichasConcedidas {
  targetUserId: string;
  targetName: string;
  chips: number;
  newBalance: number;
}

/** `alvo` aceita e-mail, id ou código público — o mesmo que a busca. */
export function concederFichas(alvo: string, chips: number, motivo: string): Promise<FichasConcedidas> {
  return apiRequest<FichasConcedidas>('/admin/suporte/conceder-fichas', {
    method: 'POST',
    body: { targetUserId: alvo, chips, reason: motivo },
  });
}

export interface LancamentoDoExtrato {
  amount: number;
  reason: string;
  gameId?: string | null;
  createdAt: string;
}

export function extratoDe(userId: string): Promise<LancamentoDoExtrato[]> {
  return apiRequest<LancamentoDoExtrato[]>(`/admin/carteira/${encodeURIComponent(userId)}/historico`);
}
