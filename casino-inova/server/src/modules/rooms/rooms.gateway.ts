import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BancaFrancesaTable, BancaFrancesaTableService, TableVisibility } from './banca-francesa-table.service';
import { FriendsService } from '../friends/friends.service';
import { BancaFrancesaBet } from '../games/banca-francesa/banca-francesa.engine';
import { ChatScope, ChatService } from '../chat/chat.service';

/**
 * Uma mesa compartilhada não precisa esconder nada de ninguém (todo mundo vê a
 * aposta de todo mundo, igual mesa física) — por isso cada evento devolve o estado
 * inteiro da mesa pra quem chamou (via ack) *e* transmite pra sala inteira (todo
 * mundo sentado recebe a atualização). Sem autenticação real ainda: `userId` viaja
 * explícito em cada mensagem, igual ao resto da API.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RoomsGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly socketsByUser = new Map<string, Set<string>>();

  constructor(
    private readonly tables: BancaFrancesaTableService,
    private readonly friends: FriendsService,
    private readonly chat: ChatService,
  ) {}

  handleDisconnect(socket: Socket) {
    for (const [userId, socketIds] of this.socketsByUser) {
      socketIds.delete(socket.id);
      if (socketIds.size === 0) this.socketsByUser.delete(userId);
    }
  }

  @SubscribeMessage('identificar')
  handleIdentify(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string }) {
    if (!body?.userId) return { ok: false };
    const set = this.socketsByUser.get(body.userId) ?? new Set<string>();
    set.add(socket.id);
    this.socketsByUser.set(body.userId, set);
    return { ok: true };
  }

  @SubscribeMessage('banca-francesa:criar-mesa')
  handleCreateTable(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; visibility: TableVisibility }) {
    return this.safe(() => {
      const table = this.tables.createTable(body.userId, body.visibility);
      socket.join(table.id);
      return this.view(table);
    });
  }

  @SubscribeMessage('banca-francesa:mesas-publicas')
  handleListPublic() {
    return this.safe(() => this.tables.listPublicTables());
  }

  @SubscribeMessage('banca-francesa:entrar-por-codigo')
  handleJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; code: string }) {
    return this.safe(() => {
      const table = this.tables.joinByCode(body.userId, body.code);
      socket.join(table.id);
      return this.broadcastAndReturn(table);
    });
  }

  @SubscribeMessage('banca-francesa:entrar-por-id')
  handleJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const table = this.tables.joinById(body.userId, body.tableId);
      socket.join(table.id);
      return this.broadcastAndReturn(table);
    });
  }

  @SubscribeMessage('banca-francesa:convidar-amigo')
  handleInviteFriend(@MessageBody() body: { userId: string; tableId: string; friendUserId: string }) {
    return this.safe(() => {
      const isFriend = this.friends.listFriends(body.userId).some((friend) => friend.userId === body.friendUserId);
      if (!isFriend) {
        return { enviado: false, motivo: 'Só dá pra convidar quem já é seu amigo.' };
      }
      const socketIds = this.socketsByUser.get(body.friendUserId);
      if (socketIds) {
        for (const socketId of socketIds) {
          this.server.to(socketId).emit('banca-francesa:convite-recebido', { fromUserId: body.userId, tableId: body.tableId });
        }
      }
      return { enviado: true, amigoOnline: Boolean(socketIds?.size) };
    });
  }

  @SubscribeMessage('banca-francesa:completar-com-bot')
  handleAddBot(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastAndReturn(this.tables.addBot(body.userId, body.tableId)));
  }

  @SubscribeMessage('banca-francesa:apostar')
  handleBet(@MessageBody() body: { userId: string; tableId: string; bets: BancaFrancesaBet[] }) {
    return this.safe(() => this.broadcastAndReturn(this.tables.placeBets(body.userId, body.tableId, body.bets)));
  }

  @SubscribeMessage('banca-francesa:girar')
  handleRoll(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastAndReturn(this.tables.roll(body.userId, body.tableId)));
  }

  @SubscribeMessage('banca-francesa:sair')
  handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const result = this.tables.leaveTable(body.userId, body.tableId);
      if ('removed' in result) {
        this.server.to(body.tableId).emit('banca-francesa:mesa-fechada');
        socket.leave(body.tableId);
        return { removed: true as const };
      }
      socket.leave(body.tableId);
      return this.broadcastAndReturn(result);
    });
  }

  @SubscribeMessage('chat:enviar')
  handleChatSend(@MessageBody() body: { userId: string; roomId: string; scope?: ChatScope; text: string }) {
    return this.safe(() => {
      const scope: ChatScope = body.scope === 'dupla' ? 'dupla' : 'mesa';
      // A cor da ficha vem do assento, pra mensagem aparecer identificada na mesa.
      const seat = this.tables.findSeat(body.roomId, body.userId);
      const message = this.chat.postMessage({
        roomId: body.roomId,
        scope,
        userId: body.userId,
        text: body.text,
        color: seat?.color,
      });
      // Escopo `mesa` vai pra sala inteira. `dupla` ainda não tem mesa 2x2 no ar —
      // quando truco/dominó em dupla existirem, o envio vai pros dois sockets da dupla.
      if (scope === 'mesa') {
        this.server.to(body.roomId).emit('chat:mensagem', message);
      }
      return message;
    });
  }

  @SubscribeMessage('chat:historico')
  handleChatHistory(@MessageBody() body: { userId: string; roomId: string; partnerUserId?: string }) {
    return this.safe(() => this.chat.historyFor(body.roomId, body.userId, body.partnerUserId));
  }

  @SubscribeMessage('chat:silenciar')
  handleChatMute(@MessageBody() body: { actingUserId: string; targetUserId: string; seconds: number }) {
    return this.safe(() => {
      const result = this.chat.muteUser(body.actingUserId, body.targetUserId, body.seconds);
      this.emitToUser(body.targetUserId, 'chat:silenciado', result);
      return result;
    });
  }

  @SubscribeMessage('chat:remover-silencio')
  handleChatUnmute(@MessageBody() body: { actingUserId: string; targetUserId: string }) {
    return this.safe(() => this.chat.unmuteUser(body.actingUserId, body.targetUserId));
  }

  private emitToUser(userId: string, event: string, payload: unknown) {
    for (const socketId of this.socketsByUser.get(userId) ?? []) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  /**
   * Todo handler acima passa por aqui: em vez de deixar uma exceção (mesa cheia,
   * saldo insuficiente, código inválido etc.) virar o evento genérico `exception`
   * do Socket.IO — que o Nest manda separado do ack e sem a mensagem original —
   * devolve o erro dentro do próprio ack, como `{ error: true, message }`. Assim
   * quem chama sempre recebe uma resposta pela mesma Promise, sucesso ou erro.
   */
  private safe<T>(fn: () => T): T | { error: true; message: string } {
    try {
      return fn();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Erro inesperado.' };
    }
  }

  private broadcastAndReturn(table: BancaFrancesaTable) {
    const payload = this.view(table);
    this.server.to(table.id).emit('banca-francesa:mesa-atualizada', payload);
    return payload;
  }

  private view(table: BancaFrancesaTable) {
    return {
      id: table.id,
      code: table.code,
      visibility: table.visibility,
      hostUserId: table.hostUserId,
      seats: table.seats.map((seat) => ({
        userId: seat.userId,
        name: seat.name,
        isBot: seat.isBot,
        color: seat.color,
        pendingBets: seat.pendingBets,
        balance: seat.isBot ? undefined : this.tables.balanceOf(seat.userId),
      })),
      lastRound: table.lastRound,
    };
  }
}
