import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import type { Role } from '../roles/roles.constants';
import { DatabaseService } from '../../database/database.service';

const scryptAsync = promisify(scrypt);

export interface User {
  id: string;
  name: string;
  level: number;
  xp: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  role: Role;
}

interface LinhaUsuario {
  id: string;
  name: string;
  level: number;
  xp: number;
  vip_tier: User['vipTier'];
  role: Role;
}

/**
 * Contas de teste que a base ganha quando está vazia.
 *
 * Sem autenticação real ainda, `u1` é o usuário "logado" (o que `/users/me` retorna) e
 * já nasce admin. `u2` existe pra ter alguém pra promover a moderador; `u3` e `u4`
 * existem porque truco e dominó se jogam 2 contra 2, e sem quatro contas não dá pra
 * exercitar uma mesa 2x2 de verdade (nem conferir que a mão de um não vaza pro outro).
 *
 * A semente só roda em base vazia — reiniciar o servidor não recria nem sobrescreve
 * ninguém, que é o ponto de ter banco.
 *
 * Cada conta nasce com e-mail e senha (`SENHA_SEMENTE`) pra dar pra entrar e testar. A
 * senha padrão é fraca de propósito, pra ser óbvio que isto é semente de teste — em
 * base que já tem gente, este bloco inteiro nunca roda.
 */
const SENHA_SEMENTE = 'casino123';

const SEMENTE: Array<User & { fichasIniciais: number; email: string }> = [
  { id: 'u1', name: 'Convidado', level: 4, xp: 320, vipTier: 'prata', role: 'admin', fichasIniciais: 12_500, email: 'u1@teste.local' },
  { id: 'u2', name: 'Suporte Ana', level: 1, xp: 0, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u2@teste.local' },
  { id: 'u3', name: 'Teste Bruno', level: 2, xp: 40, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u3@teste.local' },
  { id: 'u4', name: 'Teste Carla', level: 2, xp: 60, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u4@teste.local' },
];

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  /** Chamado uma vez na subida do servidor, depois do esquema estar aplicado. */
  async seedIfEmpty() {
    const existente = await this.db.queryOne<{ total: number }>('SELECT COUNT(*)::int AS total FROM users');
    if ((existente?.total ?? 0) > 0) return;

    await this.db.transaction(async (client) => {
      for (const usuario of SEMENTE) {
        await client.query(
          `INSERT INTO users (id, name, level, xp, vip_tier, role) VALUES ($1,$2,$3,$4,$5,$6)`,
          [usuario.id, usuario.name, usuario.level, usuario.xp, usuario.vipTier, usuario.role],
        );
        const sal = randomBytes(16);
        const derivada = (await scryptAsync(SENHA_SEMENTE, sal, 64)) as Buffer;
        await client.query(
          `INSERT INTO credentials (provider, subject, user_id, password_hash)
           VALUES ('senha', $1, $2, $3)`,
          [usuario.email, usuario.id, `${sal.toString('hex')}:${derivada.toString('hex')}`],
        );

        if (usuario.fichasIniciais > 0) {
          await client.query(
            `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1,'ajuste',$2,'semente')`,
            [usuario.id, usuario.fichasIniciais],
          );
        }
      }
    });
  }

  async findMe(): Promise<User> {
    const usuario = await this.findById('u1');
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    return usuario;
  }

  async findById(id: string): Promise<User | undefined> {
    const linha = await this.db.queryOne<LinhaUsuario>('SELECT * FROM users WHERE id = $1', [id]);
    return linha ? paraUsuario(linha) : undefined;
  }

  async list(): Promise<User[]> {
    const linhas = await this.db.query<LinhaUsuario>('SELECT * FROM users ORDER BY id');
    return linhas.map(paraUsuario);
  }

  async updateRole(userId: string, role: Role): Promise<User> {
    const linha = await this.db.queryOne<LinhaUsuario>(
      'UPDATE users SET role = $2 WHERE id = $1 RETURNING *',
      [userId, role],
    );
    if (!linha) throw new NotFoundException('Usuário não encontrado.');
    return paraUsuario(linha);
  }
}

function paraUsuario(linha: LinhaUsuario): User {
  return {
    id: linha.id,
    name: linha.name,
    level: linha.level,
    xp: linha.xp,
    vipTier: linha.vip_tier,
    role: linha.role,
  };
}
