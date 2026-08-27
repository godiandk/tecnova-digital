import { apiRequest } from './client';
import { salvarToken, definirUsuario, limparSessao } from './session';
import { fecharSocket } from './socket';

export interface UsuarioLogado {
  id: string;
  name: string;
  level: number;
  xp: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  role: string;
}

interface RespostaSessao {
  token: string;
  user: UsuarioLogado;
}

export async function entrar(email: string, senha: string): Promise<UsuarioLogado> {
  const resposta = await apiRequest<RespostaSessao>('/auth/entrar', {
    method: 'POST',
    body: { email, senha },
  });
  await salvarToken(resposta.token, resposta.user);
  return resposta.user;
}

export async function cadastrar(nome: string, email: string, senha: string): Promise<UsuarioLogado> {
  const resposta = await apiRequest<RespostaSessao>('/auth/cadastrar', {
    method: 'POST',
    body: { nome, email, senha },
  });
  await salvarToken(resposta.token, resposta.user);
  return resposta.user;
}

/**
 * Confere se o token guardado ainda vale e recupera quem é o dono dele. Chamado na
 * subida do app: token expirado devolve 401, o cliente de API limpa a sessão sozinho e
 * o app cai na tela de login.
 */
export async function recuperarSessao(): Promise<UsuarioLogado | null> {
  try {
    const usuario = await apiRequest<UsuarioLogado>('/auth/eu');
    definirUsuario(usuario);
    return usuario;
  } catch {
    return null;
  }
}

export async function sair() {
  await limparSessao();
  fecharSocket();
}
