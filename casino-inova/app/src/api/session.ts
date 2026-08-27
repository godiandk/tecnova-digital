import * as SecureStore from 'expo-secure-store';

/**
 * A sessão de quem está logado.
 *
 * O token fica no SecureStore (Keychain no iOS, Keystore no Android), não em
 * AsyncStorage: AsyncStorage é um arquivo comum, legível por qualquer processo num
 * aparelho com root ou jailbreak. Token de sessão é a chave da carteira de alguém.
 *
 * Vive aqui, num módulo só, e não num contexto de React, porque o cliente de API e o
 * socket precisam dele fora de qualquer componente.
 */
const CHAVE = 'casino-inova-token';

let tokenEmMemoria: string | null = null;
let usuarioEmMemoria: { id: string; name: string } | null = null;
const ouvintes = new Set<(logado: boolean) => void>();

/**
 * Quem está logado, pra tela conseguir marcar "essa mensagem é minha" ou "essa linha
 * do ranking sou eu". Não é o que autoriza nada — quem autoriza é o token, no
 * servidor. Isto aqui é só apresentação.
 */
export function usuarioLogado() {
  return usuarioEmMemoria;
}

export function usuarioLogadoId(): string {
  return usuarioEmMemoria?.id ?? '';
}

/** Chamado uma vez na subida do app, antes de decidir qual tela mostrar. */
export async function carregarSessao(): Promise<string | null> {
  try {
    tokenEmMemoria = await SecureStore.getItemAsync(CHAVE);
  } catch {
    // Aparelho sem armazenamento seguro disponível: segue deslogado.
    tokenEmMemoria = null;
  }
  return tokenEmMemoria;
}

export function tokenAtual(): string | null {
  return tokenEmMemoria;
}

/** Guarda quem é o usuário depois de um /users/me — usado ao restaurar sessão salva. */
export function definirUsuario(usuario: { id: string; name: string }) {
  usuarioEmMemoria = usuario;
}

export async function salvarToken(token: string, usuario?: { id: string; name: string }) {
  tokenEmMemoria = token;
  if (usuario) usuarioEmMemoria = usuario;
  try {
    await SecureStore.setItemAsync(CHAVE, token);
  } catch {
    // Sem armazenamento seguro a sessão vale só enquanto o app estiver aberto.
  }
  avisar();
}

export async function limparSessao() {
  tokenEmMemoria = null;
  usuarioEmMemoria = null;
  try {
    await SecureStore.deleteItemAsync(CHAVE);
  } catch {
    // nada a fazer
  }
  avisar();
}

/** Pra tela raiz saber quando trocar entre login e lobby. */
export function aoMudarSessao(ouvinte: (logado: boolean) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function avisar() {
  for (const ouvinte of ouvintes) ouvinte(Boolean(tokenEmMemoria));
}
