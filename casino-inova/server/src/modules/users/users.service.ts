import { Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '../roles/roles.constants';

export interface User {
  id: string;
  name: string;
  level: number;
  xp: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  role: Role;
}

/**
 * Sem autenticação real ainda — login Google/Facebook/Apple/e-mail (Firebase Auth) é
 * o próximo passo da Fase 0. `u1` é o usuário "logado" (o que `/users/me` retorna) e
 * já nasce `admin`. `u2` existe só pra ter alguém pra promover a moderador e testar
 * o fluxo de papéis pelo curl antes de existir conta de verdade.
 */
@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 'u1', name: 'Convidado', level: 4, xp: 320, vipTier: 'prata', role: 'admin' },
    { id: 'u2', name: 'Suporte Ana', level: 1, xp: 0, vipTier: 'bronze', role: 'jogador' },
  ];

  findMe(): User {
    return this.users[0];
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  list(): User[] {
    return this.users;
  }

  updateRole(userId: string, role: Role): User {
    const user = this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    user.role = role;
    return user;
  }
}
