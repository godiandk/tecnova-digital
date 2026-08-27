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
import { AuthService } from '../auth/auth.service';

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
  /** socketId -> userId, preenchido no `identificar` com o token conferido. */
  private readonly userIdBySocket = new Map<string, string>();

  constructor(
    private readonly tables: BancaFrancesaTableService,
    private readonly friends: FriendsService,
    private readonly chat: ChatService,
    private readonly trucoTables: TrucoTableService,
    private readonly dominoTables: DominoTableService,
    private readonly auth: AuthService,
  ) {}

  handleDisconnect(socket: Socket) {
    this.userIdBySocket.delete(socket.id);
    for (const [userId, socketIds] of this.socketsByUser) {
      socketIds.delete(socket.id);
      if (socketIds.size === 0) this.socketsByUser.delete(userId);
    }
  }

  /**
   * Primeira coisa que o cliente manda ao conectar. Antes bastava dizer "sou o u1" e o
   * servidor acreditava — qualquer um podia se passar por qualquer pessoa, sentar na
   * mesa dela e apostar as fichas dela. Agora vem o token assinado, e quem o socket é
   * fica decidido aqui, uma vez só: nenhum evento depois disso lê identidade do corpo.
   */
  @SubscribeMessage('identificar')
  handleIdentify(@ConnectedSocket() socket: Socket, @MessageBody() body: { token: string }) {
    return this.safe(() => {
      const userId = this.auth.verificarToken(body?.token ?? '');
      this.userIdBySocket.set(socket.id, userId);
      const set = this.socketsByUser.get(userId) ?? new Set<string>();
      set.add(socket.id);
      this.socketsByUser.set(userId, set);
      return { ok: true, userId };
    });
  }

  /**
   * Envelope de todo evento de mesa: descobre quem é o socket, entrega o userId
   * conferido pro handler e traduz exceção em resposta (via `safe`).
   *
   * Existir como envelope, e não como uma linha copiada em cada handler, é o que
   * garante que um evento novo não consiga esquecer de conferir a identidade — sem
   * chamar isto aqui, o handler simplesmente não tem de onde tirar o userId.
   */
  private comUsuario<T>(socket: Socket, fn: (usuario: string) => T | Promise<T>) {
    return this.safe(async () => fn(this.exigirUsuario(socket)));
  }

  /**
   * Quem é este socket. Lança se ainda não se identificou — todo evento de mesa passa
   * por aqui, então esquecer de identificar dá erro claro em vez de agir como ninguém.
   */
  private exigirUsuario(socket: Socket): string {
    const userId = this.userIdBySocket.get(socket.id);
    if (!userId) {
      throw new Error('Identifique-se antes (envie "identificar" com o seu token).');
    }
    return userId;
  }

  @SubscribeMessage('banca-francesa:criar-mesa')
  handleCreateTable(@ConnectedSocket() socket: Socket, @MessageBody() body: { visibility: TableVisibility }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.tables.createTable(usuario, body.visibility);
      socket.join(table.id);
      return this.view(table);
    });
  }

  @SubscribeMessage('banca-francesa:mesas-publicas')
  handleListPublic() {
    return this.safe(async () => this.tables.listPublicTables());
  }

  @SubscribeMessage('banca-francesa:entrar-por-codigo')
  handleJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { code: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.tables.joinByCode(usuario, body.code);
      socket.join(table.id);
      return this.broadcastAndReturn(table);
    });
  }

  @SubscribeMessage('banca-francesa:entrar-por-id')
  handleJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.tables.joinById(usuario, body.tableId);
      socket.join(table.id);
      return this.broadcastAndReturn(table);
    });
  }

  @SubscribeMessage('banca-francesa:convidar-amigo')
  async handleInviteFriend(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; friendUserId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const isFriend = await this.friends.areFriends(usuario, body.friendUserId);
      if (!isFriend) {
        return { enviado: false, motivo: 'Só dá pra convidar quem já é seu amigo.' };
      }
      const socketIds = this.socketsByUser.get(body.friendUserId);
      if (socketIds) {
        for (const socketId of socketIds) {
          this.server.to(socketId).emit('banca-francesa:convite-recebido', { fromUserId: usuario, tableId: body.tableId });
        }
      }
      return { enviado: true, amigoOnline: Boolean(socketIds?.size) };
    });
  }

  @SubscribeMessage('banca-francesa:completar-com-bot')
  handleAddBot(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastAndReturn(this.tables.addBot(usuario, body.tableId)));
  }

  @SubscribeMessage('banca-francesa:apostar')
  async handleBet(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; bets: BancaFrancesaBet[] }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastAndReturn(await this.tables.placeBets(usuario, body.tableId, body.bets)));
  }

  @SubscribeMessage('banca-francesa:girar')
  async handleRoll(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastAndReturn(await this.tables.roll(usuario, body.tableId)));
  }

  @SubscribeMessage('banca-francesa:sair')
  handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const result = this.tables.leaveTable(usuario, body.tableId);
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
  handleChatSend(@ConnectedSocket() socket: Socket, @MessageBody() body: { roomId: string; scope?: ChatScope; text: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const scope: ChatScope = body.scope === 'dupla' ? 'dupla' : 'mesa';

      // Falar com o parceiro só faz sentido em mesa de dupla (truco/dominó 2x2). Se
      // não tem parceiro, é melhor recusar do que guardar uma mensagem que ninguém
      // nunca vai ler.
      const partnerUserId = scope === 'dupla' ? this.partnerUserIdOf(body.roomId, usuario) : undefined;
      if (scope === 'dupla' && !partnerUserId) {
        throw new Error('Você não tem parceiro nesta mesa.');
      }

      // A cor da ficha vem do assento, pra mensagem aparecer identificada na mesa.
      const seat = this.tables.findSeat(body.roomId, usuario);
      const message = await this.chat.postMessage({
        roomId: body.roomId,
        scope,
        userId: usuario,
        text: body.text,
        color: seat?.color,
      });

      if (scope === 'mesa') {
        this.server.to(body.roomId).emit('chat:mensagem', message);
      } else {
        // Dupla vai socket a socket, só pros dois. Mandar pra sala entregaria a
        // conversa na mão dos adversários, que é exatamente o que não pode.
        this.emitToUser(usuario, 'chat:mensagem', message);
        this.emitToUser(partnerUserId as string, 'chat:mensagem', message);
      }
      return message;
    });
  }

  @SubscribeMessage('chat:historico')
  handleChatHistory(@ConnectedSocket() socket: Socket, @MessageBody() body: { roomId: string }) {
    return this.comUsuario(socket, async (usuario) =>
      // Quem é o parceiro é o servidor que decide, olhando o assento. Se viesse do
      // cliente, bastava mandar o userId do adversário pra ler a conversa da outra
      // dupla.
      await this.chat.historyFor(body.roomId, usuario, this.partnerUserIdOf(body.roomId, usuario)),
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
  handleChatMute(@ConnectedSocket() socket: Socket, @MessageBody() body: { targetUserId: string; seconds: number }) {
    return this.comUsuario(socket, async (usuario) => {
      const result = await this.chat.muteUser(usuario, body.targetUserId, body.seconds);
      this.emitToUser(body.targetUserId, 'chat:silenciado', result);
      return result;
    });
  }

  @SubscribeMessage('chat:remover-silencio')
  handleChatUnmute(@ConnectedSocket() socket: Socket, @MessageBody() body: { targetUserId: string }) {
    return this.comUsuario(socket, async (usuario) => await this.chat.unmuteUser(usuario, body.targetUserId));
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
    body: { visibility: TableVisibility; variant?: TrucoVariant; style?: TrucoStyle; buyIn: number },
  ) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.trucoTables.createTable(usuario, {
        visibility: body.visibility,
        variant: body.variant,
        style: body.style,
        buyIn: body.buyIn,
      });
      socket.join(table.id);
      return this.trucoTables.viewFor(table, usuario);
    });
  }

  @SubscribeMessage('truco:mesas-publicas')
  handleTrucoListPublic() {
    return this.safe(async () => this.trucoTables.listPublicTables());
  }

  @SubscribeMessage('truco:entrar-por-codigo')
  handleTrucoJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { code: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.trucoTables.joinByCode(usuario, body.code);
      socket.join(table.id);
      return this.broadcastTruco(table, usuario);
    });
  }

  @SubscribeMessage('truco:entrar-por-id')
  handleTrucoJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.trucoTables.joinById(usuario, body.tableId);
      socket.join(table.id);
      return this.broadcastTruco(table, usuario);
    });
  }

  @SubscribeMessage('truco:completar-com-bot')
  handleTrucoAddBot(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastTruco(this.trucoTables.addBot(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('truco:comecar')
  async handleTrucoStart(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastTruco(await this.trucoTables.start(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('truco:jogar-carta')
  handleTrucoPlayCard(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; card: Card }) {
    return this.comUsuario(socket, async (usuario) =>
      this.broadcastTruco(this.trucoTables.playCard(usuario, body.tableId, body.card), usuario),
    );
  }

  @SubscribeMessage('truco:pedir')
  handleTrucoCallRaise(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastTruco(this.trucoTables.callRaise(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('truco:responder')
  handleTrucoRespond(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; response: 'aceitar' | 'correr' | 'aumentar' },
  ) {
    return this.comUsuario(socket, async (usuario) =>
      this.broadcastTruco(this.trucoTables.respondRaise(usuario, body.tableId, body.response), usuario),
    );
  }

  /**
   * Sinal (a careta) vai SÓ pro socket do parceiro — nunca pra sala. Se fosse
   * transmitido pra mesa, os adversários veriam, e o sinal perderia o sentido.
   */
  @SubscribeMessage('truco:sinal')
  handleTrucoSignal(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; signalId: TrucoSignalId }) {
    return this.comUsuario(socket, async (usuario) => {
      const result = this.trucoTables.makeSignal(usuario, body.tableId, body.signalId);
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
  handleTrucoLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const result = this.trucoTables.leaveTable(usuario, body.tableId);
      socket.leave(body.tableId);
      if ('removed' in result) {
        this.server.to(body.tableId).emit('truco:mesa-fechada');
        return { removed: true as const };
      }
      return this.broadcastTruco(result, usuario);
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
    @MessageBody() body: { visibility: TableVisibility; buyIn: number },
  ) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.dominoTables.createTable(usuario, { visibility: body.visibility, buyIn: body.buyIn });
      socket.join(table.id);
      return this.dominoTables.viewFor(table, usuario);
    });
  }

  @SubscribeMessage('domino:mesas-publicas')
  handleDominoListPublic() {
    return this.safe(async () => this.dominoTables.listPublicTables());
  }

  @SubscribeMessage('domino:entrar-por-codigo')
  handleDominoJoinByCode(@ConnectedSocket() socket: Socket, @MessageBody() body: { code: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.dominoTables.joinByCode(usuario, body.code);
      socket.join(table.id);
      return this.broadcastDomino(table, usuario);
    });
  }

  @SubscribeMessage('domino:entrar-por-id')
  handleDominoJoinById(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const table = await this.dominoTables.joinById(usuario, body.tableId);
      socket.join(table.id);
      return this.broadcastDomino(table, usuario);
    });
  }

  @SubscribeMessage('domino:completar-com-bot')
  handleDominoAddBot(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastDomino(this.dominoTables.addBot(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('domino:comecar')
  async handleDominoStart(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastDomino(await this.dominoTables.start(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('domino:jogar-peca')
  handleDominoPlay(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string; tile: Tile; end: BoardEnd }) {
    return this.comUsuario(socket, async (usuario) =>
      this.broadcastDomino(this.dominoTables.playTile(usuario, body.tableId, body.tile, body.end), usuario),
    );
  }

  @SubscribeMessage('domino:passar')
  handleDominoPass(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => this.broadcastDomino(this.dominoTables.pass(usuario, body.tableId), usuario));
  }

  @SubscribeMessage('domino:sair')
  handleDominoLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: { tableId: string }) {
    return this.comUsuario(socket, async (usuario) => {
      const result = this.dominoTables.leaveTable(usuario, body.tableId);
      socket.leave(body.tableId);
      if ('removed' in result) {
        this.server.to(body.tableId).emit('domino:mesa-fechada');
        return { removed: true as const };
      }
      return this.broadcastDomino(result, usuario);
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
  /**
   * Traduz exceção em resposta.
   *
   * Sem isso, um erro dentro de um handler vira um evento `exception` genérico do
   * Socket.IO com a mensagem trocada por "Internal server error" — e o ack nunca
   * chega, deixando a promessa do app pendurada pra sempre. Aqui o erro volta como
   * `{ error: true, message }` no próprio ack, que é o que a tela sabe mostrar.
   *
   * O `await` importa: agora todo handler toca o banco, e sem esperar o resultado a
   * exceção escaparia DEPOIS do try já ter terminado, virando unhandled rejection.
   */
  private async safe<T>(fn: () => T | Promise<T>): Promise<T | { error: true; message: string }> {
    try {
      return await fn();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Erro inesperado.' };
    }
  }

  private broadcastAndReturn(table: BancaFrancesaTable) {
    const payload = this.view(table);
    this.server.to(table.id).emit('banca-francesa:mesa-atualizada', payload);
    return payload;
  }

  private async view(table: BancaFrancesaTable) {
    return {
      id: table.id,
      code: table.code,
      visibility: table.visibility,
      hostUserId: table.hostUserId,
      seats: await Promise.all(
        table.seats.map(async (seat) => ({
          userId: seat.userId,
          name: seat.name,
          isBot: seat.isBot,
          color: seat.color,
          pendingBets: seat.pendingBets,
          balance: seat.isBot ? undefined : await this.tables.balanceOf(seat.userId),
        })),
      ),
      lastRound: table.lastRound,
    };
  }
}
