import { Platform } from 'react-native';
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

/*
 * ONDE O TOKEN FICA GUARDADO, e por que não é o mesmo lugar nos dois.
 *
 * No celular é o SecureStore (Keychain no iOS, Keystore no Android) — armazenamento do
 * sistema, protegido pelo aparelho.
 *
 * NA WEB O SecureStore NÃO EXISTE. Ele nem é implementado no navegador: toda chamada
 * falhava, o `catch` engolia o erro, e o token vivia só na memória da aba. O efeito era
 * o que dava pra ver: ATUALIZAR A PÁGINA DESLOGAVA. Não era sessão expirando nem token
 * inválido — era o token nunca ter sido gravado em lugar nenhum.
 *
 * Na web o lugar é o localStorage. Ele é legível por JavaScript da mesma origem, o que
 * seria um problema se a página carregasse script de terceiro; esta não carrega — o
 * site e a API são servidos pelo mesmo processo, e não existe anúncio nem widget de
 * fora. É o mesmo lugar onde qualquer aplicativo web guarda sessão.
 */
const naWeb = Platform.OS === 'web';

async function guardar(token: string): Promise<void> {
  if (naWeb) {
    globalThis.localStorage?.setItem(CHAVE, token);
    return;
  }
  await SecureStore.setItemAsync(CHAVE, token);
}

async function ler(): Promise<string | null> {
  if (naWeb) return globalThis.localStorage?.getItem(CHAVE) ?? null;
  return SecureStore.getItemAsync(CHAVE);
}

async function apagar(): Promise<void> {
  if (naWeb) {
    globalThis.localStorage?.removeItem(CHAVE);
    return;
  }
  await SecureStore.deleteItemAsync(CHAVE);
}

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
    tokenEmMemoria = await ler();
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
    await guardar(token);
  } catch {
    // Sem armazenamento seguro a sessão vale só enquanto o app estiver aberto.
  }
  avisar();
}

export async function limparSessao() {
  tokenEmMemoria = null;
  usuarioEmMemoria = null;
  try {
    await apagar();
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
