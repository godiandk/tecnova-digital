import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { DatabaseService } from '../../database/database.service';

export type FriendRequestStatus = 'pendente' | 'aceita';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
}

interface LinhaPedido {
  id: number;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: Date;
}

/**
 * Pré-requisito pro convite de sala por "+": preciso saber quem é amigo de quem antes
 * de conseguir mostrar "convide um amigo" em qualquer lugar.
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly db: DatabaseService,
  ) {}

  async sendRequest(fromUserId: string, toUserId: string): Promise<FriendRequest> {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Você não pode adicionar a si mesmo.');
    }
    if (!(await this.usersService.findById(toUserId))) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existente = await this.acharEntre(fromUserId, toUserId);
    if (existente) {
      throw new BadRequestException(
        existente.status === 'aceita' ? 'Vocês já são amigos.' : 'Já existe um pedido pendente entre vocês.',
      );
    }

    const linha = await this.db.queryOne<LinhaPedido>(
      `INSERT INTO friend_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pendente') RETURNING *`,
      [fromUserId, toUserId],
    );
    return paraPedido(linha!);
  }

  async respondToRequest(userId: string, requestId: string, accept: boolean): Promise<FriendRequest | { removed: true }> {
    const linha = await this.db.queryOne<LinhaPedido>('SELECT * FROM friend_requests WHERE id = $1', [
      Number(requestId.replace('fr-', '')),
    ]);
    if (!linha) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    if (linha.to_user_id !== userId) {
      throw new ForbiddenException('Só quem recebeu o pedido pode responder.');
    }
    if (linha.status === 'aceita') {
      throw new BadRequestException('Esse pedido já foi aceito.');
    }

    if (!accept) {
      await this.db.query('DELETE FROM friend_requests WHERE id = $1', [linha.id]);
      return { removed: true };
    }

    const atualizado = await this.db.queryOne<LinhaPedido>(
      `UPDATE friend_requests SET status = 'aceita' WHERE id = $1 RETURNING *`,
      [linha.id],
    );
    return paraPedido(atualizado!);
  }

  async listFriends(userId: string) {
    const linhas = await this.db.query<LinhaPedido & { amigo: string; nome: string; nivel: number }>(
      `SELECT fr.*,
              CASE WHEN fr.from_user_id = $1 THEN fr.to_user_id ELSE fr.from_user_id END AS amigo,
              u.name AS nome, u.level AS nivel
         FROM friend_requests fr
         JOIN users u ON u.id = CASE WHEN fr.from_user_id = $1 THEN fr.to_user_id ELSE fr.from_user_id END
        WHERE fr.status = 'aceita' AND $1 IN (fr.from_user_id, fr.to_user_id)
        ORDER BY u.name`,
      [userId],
    );
    return linhas.map((linha) => ({ userId: linha.amigo, name: linha.nome, level: linha.nivel }));
  }

  async listPending(userId: string) {
    const linhas = await this.db.query<LinhaPedido & { outro_nome: string }>(
      `SELECT fr.*,
              CASE WHEN fr.from_user_id = $1 THEN destino.name ELSE origem.name END AS outro_nome
         FROM friend_requests fr
         JOIN users origem  ON origem.id  = fr.from_user_id
         JOIN users destino ON destino.id = fr.to_user_id
        WHERE fr.status = 'pendente' AND $1 IN (fr.from_user_id, fr.to_user_id)
        ORDER BY fr.id`,
      [userId],
    );
    const comNome = (linha: LinhaPedido & { outro_nome: string }) => ({
      ...paraPedido(linha),
      otherUserName: linha.outro_nome,
    });
    return {
      recebidos: linhas.filter((linha) => linha.to_user_id === userId).map(comNome),
      enviados: linhas.filter((linha) => linha.from_user_id === userId).map(comNome),
    };
  }

  /** Usado pelo convite de mesa: só dá pra convidar quem já é amigo de verdade. */
  async areFriends(userIdA: string, userIdB: string): Promise<boolean> {
    const linha = await this.acharEntre(userIdA, userIdB);
    return linha?.status === 'aceita';
  }

  private acharEntre(a: string, b: string) {
    return this.db.queryOne<LinhaPedido>(
      `SELECT * FROM friend_requests
        WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)`,
      [a, b],
    );
  }
}

function paraPedido(linha: LinhaPedido): FriendRequest {
  return {
    id: `fr-${linha.id}`,
    fromUserId: linha.from_user_id,
    toUserId: linha.to_user_id,
    status: linha.status,
    createdAt: linha.created_at.toISOString(),
  };
}
