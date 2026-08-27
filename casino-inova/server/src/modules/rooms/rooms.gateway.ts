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
import { TrucoOnlineTable, TrucoTableService } from './truco-table.service';
import { DominoOnlineTable, DominoTableService } from './domino-table.service';
import { BoardEnd } from '../games/domino/domino.engine';
import { Tile } from '../games/domino/domino.config';
import { Card, TrucoSignalId, TrucoStyle, TrucoVariant } from '../games/truco/truco.config';

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
    private readonly trucoTables: TrucoTableService,
    private readonly dominoTables: DominoTableService,
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

      // Falar com o parceiro só faz sentido em mesa de dupla (truco/dominó 2x2). Se
      // não tem parceiro, é melhor recusar do que guardar uma mensagem que ninguém
      // nunca vai ler.
      const partnerUserId = scope === 'dupla' ? this.partnerUserIdOf(body.roomId, body.userId) : undefined;
      if (scope === 'dupla' && !partnerUserId) {
        throw new Error('Você não tem parceiro nesta mesa.');
      }

      // A cor da ficha vem do assento, pra mensagem aparecer identificada na mesa.
      const seat = this.tables.findSeat(body.roomId, body.userId);
      const message = this.chat.postMessage({
        roomId: body.roomId,
        scope,
        userId: body.userId,
        text: body.text,
        color: seat?.color,
      });

      if (scope === 'mesa') {
        this.server.to(body.roomId).emit('chat:mensagem', message);
      } else {
        // Dupla vai socket a socket, só pros dois. Mandar pra sala entregaria a
        // conversa na mão dos adversários, que é exatamente o que não pode.
        this.emitToUser(body.userId, 'chat:mensagem', message);
        this.emitToUser(partnerUserId as string, 'chat:mensagem', message);
      }
      return message;
    });
  }

  @SubscribeMessage('chat:historico')
  handleChatHistory(@MessageBody() body: { userId: string; roomId: string }) {
    return this.safe(() =>
      // Quem é o parceiro é o servidor que decide, olhando o assento. Se viesse do
      // cliente, bastava mandar o userId do adversário pra ler a conversa da outra
      // dupla.
      this.chat.historyFor(body.roomId, body.userId, this.partnerUserIdOf(body.roomId, body.userId)),
    );
  }

  /**
   * O parceiro de dupla, venha a sala do truco ou do dominó. Mesa aberta (banca
   * francesa e afins) não tem dupla, então devolve undefined e o escopo `dupla`
   * nem chega a ser aceito lá.
   */
  private partnerUserIdOf(roomId: string, userId: string): string | undefined {
    return (
      this.trucoTables.partnerUserIdOf(roomId, userId) ?? this.dominoTables.partnerUserIdOf(roomId, userId)
    );
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

  // ---------- Truco 2x2 ----------
  //
  // Diferente da banca francesa, aqui NÃO dá pra transmitir o mesmo payload pra
  // todo mundo: cada pessoa só pode ver as próprias cartas. Por isso o broadcast é
  // feito socket a socket, com uma visão montada pra cada jogador (`viewFor`).

  @SubscribeMessage('truco:criar-mesa')
  handleTrucoCreate(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { userId: string; visibility: TableVisibility; variant?: TrucoVariant; style?: TrucoStyle; buyIn: number },
  ) {
    return this.safe(() => {
      const table = this.trucoTables.createTable(body.userId, {
        visibility: body.visibility,
        variant: body.variant,
        style: body.style,
        buyIn: body.buyIn,
      });
      socket.join(table.id);
      return this.trucoTables.viewFor(table, body.userId);
    });
  }

  @SubscribeMessage('truco:mesas-publicas')
  handleTrucoListPublic() {
    return this.safe(() => this.trucoTables.listPublicTables());
  }

  @SubscribeMessage('truco:entrar-por-codigo')
  handleTrucoJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; code: string }) {
    return this.safe(() => {
      const table = this.trucoTables.joinByCode(body.userId, body.code);
      socket.join(table.id);
      return this.broadcastTruco(table, body.userId);
    });
  }

  @SubscribeMessage('truco:entrar-por-id')
  handleTrucoJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const table = this.trucoTables.joinById(body.userId, body.tableId);
      socket.join(table.id);
      return this.broadcastTruco(table, body.userId);
    });
  }

  @SubscribeMessage('truco:completar-com-bot')
  handleTrucoAddBot(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastTruco(this.trucoTables.addBot(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('truco:comecar')
  handleTrucoStart(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastTruco(this.trucoTables.start(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('truco:jogar-carta')
  handleTrucoPlayCard(@MessageBody() body: { userId: string; tableId: string; card: Card }) {
    return this.safe(() =>
      this.broadcastTruco(this.trucoTables.playCard(body.userId, body.tableId, body.card), body.userId),
    );
  }

  @SubscribeMessage('truco:pedir')
  handleTrucoCallRaise(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastTruco(this.trucoTables.callRaise(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('truco:responder')
  handleTrucoRespond(
    @MessageBody() body: { userId: string; tableId: string; response: 'aceitar' | 'correr' | 'aumentar' },
  ) {
    return this.safe(() =>
      this.broadcastTruco(this.trucoTables.respondRaise(body.userId, body.tableId, body.response), body.userId),
    );
  }

  /**
   * Sinal (a careta) vai SÓ pro socket do parceiro — nunca pra sala. Se fosse
   * transmitido pra mesa, os adversários veriam, e o sinal perderia o sentido.
   */
  @SubscribeMessage('truco:sinal')
  handleTrucoSignal(@MessageBody() body: { userId: string; tableId: string; signalId: TrucoSignalId }) {
    return this.safe(() => {
      const result = this.trucoTables.makeSignal(body.userId, body.tableId, body.signalId);
      if (result.partnerUserId) {
        this.emitToUser(result.partnerUserId, 'truco:sinal-recebido', {
          signal: result.signal,
          fromName: result.fromName,
        });
      }
      return { enviado: Boolean(result.partnerUserId), signal: result.signal };
    });
  }

  @SubscribeMessage('truco:sair')
  handleTrucoLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const result = this.trucoTables.leaveTable(body.userId, body.tableId);
      socket.leave(body.tableId);
      if ('removed' in result) {
        this.server.to(body.tableId).emit('truco:mesa-fechada');
        return { removed: true as const };
      }
      return this.broadcastTruco(result, body.userId);
    });
  }

  /**
   * Manda pra cada jogador a visão dele — é o que impede a mão de um vazar pro outro.
   * Bots não têm socket, então são pulados. Devolve a visão de quem chamou, pro ack.
   */
  private broadcastTruco(table: TrucoOnlineTable, callerUserId: string) {
    for (const seat of table.seats) {
      if (seat.isBot) continue;
      this.emitToUser(seat.userId, 'truco:mesa-atualizada', this.trucoTables.viewFor(table, seat.userId));
    }
    return this.trucoTables.viewFor(table, callerUserId);
  }

  // ---------- Dominó 2x2 ----------
  //
  // Mesma lógica de sigilo do truco: cada um só vê as próprias peças, então o
  // broadcast é socket a socket com a visão montada pra cada jogador.

  @SubscribeMessage('domino:criar-mesa')
  handleDominoCreate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { userId: string; visibility: TableVisibility; buyIn: number },
  ) {
    return this.safe(() => {
      const table = this.dominoTables.createTable(body.userId, { visibility: body.visibility, buyIn: body.buyIn });
      socket.join(table.id);
      return this.dominoTables.viewFor(table, body.userId);
    });
  }

  @SubscribeMessage('domino:mesas-publicas')
  handleDominoListPublic() {
    return this.safe(() => this.dominoTables.listPublicTables());
  }

  @SubscribeMessage('domino:entrar-por-codigo')
  handleDominoJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; code: string }) {
    return this.safe(() => {
      const table = this.dominoTables.joinByCode(body.userId, body.code);
      socket.join(table.id);
      return this.broadcastDomino(table, body.userId);
    });
  }

  @SubscribeMessage('domino:entrar-por-id')
  handleDominoJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const table = this.dominoTables.joinById(body.userId, body.tableId);
      socket.join(table.id);
      return this.broadcastDomino(table, body.userId);
    });
  }

  @SubscribeMessage('domino:completar-com-bot')
  handleDominoAddBot(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastDomino(this.dominoTables.addBot(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('domino:comecar')
  handleDominoStart(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastDomino(this.dominoTables.start(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('domino:jogar-peca')
  handleDominoPlay(@MessageBody() body: { userId: string; tableId: string; tile: Tile; end: BoardEnd }) {
    return this.safe(() =>
      this.broadcastDomino(this.dominoTables.playTile(body.userId, body.tableId, body.tile, body.end), body.userId),
    );
  }

  @SubscribeMessage('domino:passar')
  handleDominoPass(@MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => this.broadcastDomino(this.dominoTables.pass(body.userId, body.tableId), body.userId));
  }

  @SubscribeMessage('domino:sair')
  handleDominoLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { userId: string; tableId: string }) {
    return this.safe(() => {
      const result = this.dominoTables.leaveTable(body.userId, body.tableId);
      socket.leave(body.tableId);
      if ('removed' in result) {
        this.server.to(body.tableId).emit('domino:mesa-fechada');
        return { removed: true as const };
      }
      return this.broadcastDomino(result, body.userId);
    });
  }

  private broadcastDomino(table: DominoOnlineTable, callerUserId: string) {
    for (const seat of table.seats) {
      if (seat.isBot) continue;
      this.emitToUser(seat.userId, 'domino:mesa-atualizada', this.dominoTables.viewFor(table, seat.userId));
    }
    return this.dominoTables.viewFor(table, callerUserId);
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
