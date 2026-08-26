import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  name: string;
  level: number;
  xp: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
}

/**
 * Sem autenticação real ainda — login Google/Facebook/Apple/e-mail (Firebase Auth) é
 * o próximo passo da Fase 0. Por enquanto existe um único usuário fixo, só para dar
 * pra testar carteira e loja de ponta a ponta.
 */
@Injectable()
export class UsersService {
  private readonly users: User[] = [{ id: 'u1', name: 'Convidado', level: 4, xp: 320, vipTier: 'prata' }];

  findMe(): User {
    return this.users[0];
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }
}
