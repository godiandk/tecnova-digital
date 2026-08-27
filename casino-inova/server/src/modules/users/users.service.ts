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
 * já nasce `admin`. `u2` existe pra ter alguém pra promover a moderador e testar o
 * fluxo de papéis.
 *
 * `u3` e `u4` existem porque truco e dominó se jogam 2 contra 2: sem quatro contas de
 * teste não dá pra exercitar uma mesa 2x2 de verdade (nem conferir que a mão de um
 * não vaza pro outro). Some tudo isso quando o login real existir.
 */
@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 'u1', name: 'Convidado', level: 4, xp: 320, vipTier: 'prata', role: 'admin' },
    { id: 'u2', name: 'Suporte Ana', level: 1, xp: 0, vipTier: 'bronze', role: 'jogador' },
    { id: 'u3', name: 'Teste Bruno', level: 2, xp: 40, vipTier: 'bronze', role: 'jogador' },
    { id: 'u4', name: 'Teste Carla', level: 2, xp: 60, vipTier: 'bronze', role: 'jogador' },
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
