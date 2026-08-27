import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';

/**
 * Escopo da mensagem:
 * - `mesa`: todo mundo sentado vê. É o único escopo em jogo de mesa aberta
 *   (banca francesa, bac bo, roleta, bacará, blackjack, poker).
 * - `dupla`: só o seu parceiro vê. Existe apenas em truco e dominó, que se jogam
 *   2 contra 2 — é o equivalente digital de conversar baixinho com o parceiro.
 */
export type ChatScope = 'mesa' | 'dupla';

export interface ChatMessage {
  id: string;
  roomId: string;
  scope: ChatScope;
  userId: string;
  userName: string;
  /** Cor da ficha de quem falou, quando a mesa atribui cor — deixa o chat legível. */
  color?: string;
  text: string;
  at: string;
  /** Mensagem do sistema (entrou, saiu, resultado) não tem autor humano. */
  isSystem?: boolean;
}

export const MAX_MESSAGE_LENGTH = 200;
/** Quantas mensagens ficam guardadas por sala — é chat de mesa, não histórico eterno. */
const HISTORY_LIMIT = 50;
/** Anti-flood: no máximo essas mensagens dentro da janela abaixo. */
const RATE_LIMIT_MESSAGES = 5;
const RATE_LIMIT_WINDOW_MS = 5_000;

@Injectable()
export class ChatService {
  private readonly history = new Map<string, ChatMessage[]>();
  private readonly recentByUser = new Map<string, number[]>();
  /** userId -> timestamp (ms) até quando está silenciado. */
  private readonly mutedUntil = new Map<string, number>();
  private nextId = 1;

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  postMessage(params: {
    roomId: string;
    scope: ChatScope;
    userId: string;
    text: string;
    color?: string;
  }): ChatMessage {
    const { roomId, scope, userId, text, color } = params;

    const mutedUntil = this.mutedUntil.get(userId);
    if (mutedUntil && mutedUntil > Date.now()) {
      const seconds = Math.ceil((mutedUntil - Date.now()) / 1000);
      throw new ForbiddenException(`Você está silenciado por mais ${seconds}s.`);
    }

    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Mensagem vazia.');
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Mensagem muito longa (máximo ${MAX_MESSAGE_LENGTH} caracteres).`);
    }
    this.enforceRateLimit(userId);

    const user = this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    return this.append({
      roomId,
      scope,
      userId,
      userName: user.name,
      color,
      text: trimmed,
      at: new Date().toISOString(),
    });
  }

  /** Aviso automático da mesa ("Fulano entrou", "Saiu Grande"), sem autor humano. */
  postSystemMessage(roomId: string, text: string, scope: ChatScope = 'mesa'): ChatMessage {
    return this.append({
      roomId,
      scope,
      userId: 'sistema',
      userName: 'Mesa',
      text,
      at: new Date().toISOString(),
      isSystem: true,
    });
  }

  /**
   * Histórico da sala. `partnerUserId` é quem forma dupla com quem está pedindo —
   * mensagens de escopo `dupla` só aparecem pra esses dois. Sem isso, um jogador
   * conseguiria ler a conversa privada da dupla adversária.
   */
  historyFor(roomId: string, userId: string, partnerUserId?: string): ChatMessage[] {
    const all = this.history.get(roomId) ?? [];
    return all.filter((message) => {
      if (message.scope === 'mesa') return true;
      return message.userId === userId || (partnerUserId !== undefined && message.userId === partnerUserId);
    });
  }

  /** Silenciar reusa a permissão `silenciar_usuario` que o módulo de papéis já define. */
  muteUser(actingUserId: string, targetUserId: string, seconds: number) {
    this.rolesService.requirePermission(actingUserId, 'silenciar_usuario');
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 24 * 60 * 60) {
      throw new BadRequestException('Tempo de silenciamento inválido.');
    }
    const until = Date.now() + seconds * 1000;
    this.mutedUntil.set(targetUserId, until);
    return { targetUserId, mutedUntilIso: new Date(until).toISOString() };
  }

  unmuteUser(actingUserId: string, targetUserId: string) {
    this.rolesService.requirePermission(actingUserId, 'silenciar_usuario');
    this.mutedUntil.delete(targetUserId);
    return { targetUserId, muted: false };
  }

  isMuted(userId: string): boolean {
    const until = this.mutedUntil.get(userId);
    return Boolean(until && until > Date.now());
  }

  clearRoom(roomId: string) {
    this.history.delete(roomId);
  }

  private append(message: Omit<ChatMessage, 'id'>): ChatMessage {
    const full: ChatMessage = { ...message, id: `msg-${this.nextId}` };
    this.nextId += 1;

    const list = this.history.get(message.roomId) ?? [];
    list.push(full);
    if (list.length > HISTORY_LIMIT) {
      list.splice(0, list.length - HISTORY_LIMIT);
    }
    this.history.set(message.roomId, list);
    return full;
  }

  private enforceRateLimit(userId: string) {
    const now = Date.now();
    const recent = (this.recentByUser.get(userId) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MESSAGES) {
      throw new BadRequestException('Devagar — muitas mensagens seguidas.');
    }
    recent.push(now);
    this.recentByUser.set(userId, recent);
  }
}
