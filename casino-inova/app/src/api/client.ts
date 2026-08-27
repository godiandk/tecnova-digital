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
 * Se um dia isso for pra produção, basta definir `EXPO_PUBLIC_API_URL` com a URL do
 * servidor publicado, que ela tem prioridade sobre tudo.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { manifest2?: { extra?: { expoGo?: { developer?: { host?: string } } } } }).manifest2?.extra?.expoGo?.developer?.host;
  const host = hostUri?.split(':')[0];

  if (host) return `http://${host}:${SERVER_PORT}`;

  // Último recurso (build sem Metro): só funciona no simulador da própria máquina.
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
