/**
 * A Fase 0 não tem autenticação real ainda, então todo request usa o mesmo usuário
 * mock do servidor (`u1` — ver server/src/modules/users/users.service.ts). Isso troca
 * pelo id do usuário logado assim que o login existir.
 *
 * `API_BASE_URL`: no simulador iOS, `localhost` funciona. No emulador Android, use
 * `http://10.0.2.2:3000`. Num celular físico, use o IP da sua máquina na rede local
 * (ex: `http://192.168.0.10:3000`) — o celular não enxerga "localhost" da máquina.
 */
export const API_BASE_URL = 'http://localhost:3000';
export const MOCK_USER_ID = 'u1';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = payload?.message ?? `Erro ${response.status} ao falar com o servidor.`;
    throw new ApiError(Array.isArray(message) ? message.join(' ') : message, response.status);
  }

  return payload as T;
}
