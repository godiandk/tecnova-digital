import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, MOCK_USER_ID } from './client';

let socket: Socket | null = null;

/**
 * Uma conexão só pro app inteiro (as mesas em tempo real usam todas a mesma). Assim
 * que conecta — e a cada reconexão automática — manda `identificar`, que é o que
 * permite o servidor achar seu socket pra entregar convite de amigo.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_BASE_URL, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket?.emit('identificar', { userId: MOCK_USER_ID });
  });
  return socket;
}

export class SocketError extends Error {}

/**
 * O gateway devolve `{ error: true, message }` no próprio ack quando alguma regra
 * barra a ação (mesa cheia, saldo insuficiente, código errado) — ver o método
 * `safe()` em server/src/modules/rooms/rooms.gateway.ts. Aqui isso vira exceção,
 * pra tela tratar com try/catch igual faz com a API HTTP.
 */
export function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  const client = getSocket();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new SocketError('O servidor não respondeu a tempo.')), 10_000);

    client.emit(event, payload, (response: unknown) => {
      clearTimeout(timeout);
      if (response && typeof response === 'object' && 'error' in response) {
        reject(new SocketError(String((response as { message?: string }).message ?? 'Não deu pra fazer isso agora.')));
        return;
      }
      resolve(response as T);
    });
  });
}
