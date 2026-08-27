import Constants from 'expo-constants';
import { limparSessao, tokenAtual } from './session';

const SERVER_PORT = 3000;

/**
 * Descobre sozinho o endereço do servidor.
 *
 * O problema que isso resolve: num iPhone de verdade, "localhost" é o próprio
 * iPhone — não o computador onde o servidor está rodando. Então um endereço fixo
 * `http://localhost:3000` funciona no simulador e falha no celular, com um erro de
 * rede que não explica nada.
 *
 * A saída: quando você roda `npx expo start`, o Expo já sabe o IP da sua máquina na
 * rede local (é o endereço que aparece no QR Code), e expõe isso em `hostUri`, algo
 * como "192.168.0.10:8081". A gente aproveita esse IP e só troca a porta pela do
 * servidor. Assim funciona no celular físico, no simulador e no emulador, sem você
 * precisar editar nada.
 *
 * Publicado, o caminho é outro: o servidor entrega o próprio app como site, então a
 * API está no MESMO endereço da página e basta usar a origem dela. É o que faz o jogo
 * funcionar em qualquer domínio sem recompilar e sem configurar CORS.
 *
 * `EXPO_PUBLIC_API_URL` continua tendo prioridade sobre tudo, pra quando o servidor
 * ficar num endereço diferente do site.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { manifest2?: { extra?: { expoGo?: { developer?: { host?: string } } } } }).manifest2?.extra?.expoGo?.developer?.host;
  const host = hostUri?.split(':')[0];

  if (host) return `http://${host}:${SERVER_PORT}`;

  /*
   * Sem hostUri e rodando no navegador: é o site publicado, servido pelo próprio
   * servidor. A API está na mesma origem da página.
   */
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Último recurso (build nativo sem Metro): só o simulador da própria máquina.
  return `http://localhost:${SERVER_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const token = tokenAtual();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Quem você é vai no cabeçalho, assinado. Nenhuma rota lê identidade do corpo.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  // Token expirado ou revogado: derruba a sessão pra o app voltar pro login em vez de
  // ficar mostrando erro em toda tela.
  if (response.status === 401) {
    await limparSessao();
  }

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = payload?.message ?? `Erro ${response.status} ao falar com o servidor.`;
    throw new ApiError(Array.isArray(message) ? message.join(' ') : message, response.status);
  }

  return payload as T;
}
