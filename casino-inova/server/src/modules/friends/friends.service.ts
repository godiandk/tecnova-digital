import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

export type FriendRequestStatus = 'pendente' | 'aceita';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
}

/**
 * Pré-requisito pro convite de sala por "+": preciso saber quem é amigo de quem antes
 * de conseguir mostrar "convide um amigo" em qualquer lugar. Em memória, como todo o
 * resto desta v1 — uma tabela `friendships` no Postgres é a versão de produção.
 */
@Injectable()
export class FriendsService {
  private readonly requests: FriendRequest[] = [];
  private nextId = 1;

  constructor(private readonly usersService: UsersService) {}

  sendRequest(fromUserId: string, toUserId: string): FriendRequest {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Você não pode adicionar a si mesmo.');
    }
    if (!this.usersService.findById(toUserId)) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    const existing = this.requests.find((request) => this.involves(request, fromUserId, toUserId));
    if (existing) {
      throw new BadRequestException(existing.status === 'aceita' ? 'Vocês já são amigos.' : 'Já existe um pedido pendente entre vocês.');
    }

    const request: FriendRequest = {
      id: `fr-${this.nextId}`,
      fromUserId,
      toUserId,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;
    this.requests.push(request);
    return request;
  }

  respondToRequest(userId: string, requestId: string, accept: boolean): FriendRequest | { removed: true } {
    const request = this.requireRequest(requestId);
    if (request.toUserId !== userId) {
      throw new ForbiddenException('Esse pedido não é seu para responder.');
    }
    if (!accept) {
      this.requests.splice(this.requests.indexOf(request), 1);
      return { removed: true };
    }
    request.status = 'aceita';
    return request;
  }

  listFriends(userId: string) {
    return this.requests
      .filter((request) => request.status === 'aceita' && (request.fromUserId === userId || request.toUserId === userId))
      .map((request) => {
        const friendId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
        const friend = this.usersService.findById(friendId);
        return { userId: friendId, name: friend?.name ?? friendId, level: friend?.level ?? 1 };
      });
  }

  listPending(userId: string) {
    const withName = (request: FriendRequest, otherId: string) => ({
      ...request,
      otherUserName: this.usersService.findById(otherId)?.name ?? otherId,
    });
    return {
      recebidos: this.requests
        .filter((request) => request.status === 'pendente' && request.toUserId === userId)
        .map((request) => withName(request, request.fromUserId)),
      enviados: this.requests
        .filter((request) => request.status === 'pendente' && request.fromUserId === userId)
        .map((request) => withName(request, request.toUserId)),
    };
  }

  private requireRequest(requestId: string): FriendRequest {
    const request = this.requests.find((item) => item.id === requestId);
    if (!request) {
      throw new NotFoundException('Pedido de amizade não encontrado.');
    }
    return request;
  }

  private involves(request: FriendRequest, a: string, b: string): boolean {
    return (request.fromUserId === a && request.toUserId === b) || (request.fromUserId === b && request.toUserId === a);
  }
}
