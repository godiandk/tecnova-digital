import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../../database/database.service';
import { UsersService, User } from '../users/users.service';
import { firebaseEstaLigado, verificarTokenFirebase } from './firebase';

const scryptAsync = promisify(scrypt);

/** Quanto tempo o token vale. Curto o bastante pra um vazamento não ser eterno. */
const VALIDADE_TOKEN = '30d';

/** Os provedores de login social que o app oferece. */
const PROVEDORES_ACEITOS = ['google', 'apple', 'facebook'];

export interface TokenPayload {
  /** userId. `sub` é o nome padrão desse campo em JWT. */
  sub: string;
}

/**
 * Autenticação.
 *
 * A senha é guardada como scrypt com sal por conta — nunca em texto, e nunca com um
 * hash rápido como SHA-256. Hash rápido é justamente o que torna um vazamento de banco
 * catastrófico: dá pra testar bilhões de senhas por segundo. scrypt é lento e come
 * memória de propósito, o que derruba a taxa de tentativa em ordens de grandeza.
 *
 * O login por Google/Apple/Facebook passa pelo Firebase Auth: o app faz o login com o
 * provedor, recebe um token, e manda pra cá; aqui a gente confere com o Google que o
 * token é legítimo antes de criar sessão nenhuma (ver `firebase.ts`).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
  ) {}

  private get segredo(): string {
    const valor = process.env.JWT_SECRET;
    if (!valor) {
      throw new Error('JWT_SECRET não está definida — o servidor não assina token sem ela.');
    }
    return valor;
  }

  async registrarComSenha(email: string, senha: string, nome: string) {
    const emailNormalizado = normalizarEmail(email);
    if (!emailNormalizado.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }
    if (!senha || senha.length < 8) {
      throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
    }
    if (!nome?.trim()) {
      throw new BadRequestException('Informe um nome.');
    }

    const existente = await this.db.queryOne(
      `SELECT 1 FROM credentials WHERE provider = 'senha' AND subject = $1`,
      [emailNormalizado],
    );
    if (existente) {
      throw new BadRequestException('Já existe uma conta com esse e-mail.');
    }

    const userId = `u-${randomBytes(9).toString('base64url')}`;
    const hash = await gerarHash(senha);

    await this.db.transaction(async (client) => {
      await client.query(`INSERT INTO users (id, name) VALUES ($1, $2)`, [userId, nome.trim()]);
      await client.query(
        `INSERT INTO credentials (provider, subject, user_id, password_hash) VALUES ('senha', $1, $2, $3)`,
        [emailNormalizado, userId, hash],
      );
    });

    return this.sessaoDe(userId);
  }

  async loginComSenha(email: string, senha: string) {
    const linha = await this.db.queryOne<{ user_id: string; password_hash: string | null }>(
      `SELECT user_id, password_hash FROM credentials WHERE provider = 'senha' AND subject = $1`,
      [normalizarEmail(email)],
    );

    /*
     * Mesma mensagem pra e-mail que não existe e senha errada, de propósito: dizer
     * "esse e-mail não está cadastrado" entrega quem tem conta aqui pra quem estiver
     * testando listas de e-mail vazadas.
     */
    const generico = new UnauthorizedException('E-mail ou senha incorretos.');
    if (!linha?.password_hash) {
      // Gasta o mesmo tempo de um login válido, pra a demora não denunciar a diferença.
      await gerarHash(senha ?? '');
      throw generico;
    }
    if (!(await senhaConfere(senha ?? '', linha.password_hash))) {
      throw generico;
    }
    return this.sessaoDe(linha.user_id);
  }

  /**
   * Login por provedor externo (Google, Apple, Facebook via Firebase Auth). A conta é
   * criada na primeira vez que a pessoa entra — é assim que login social funciona.
   */
  async loginComProvedor(provedor: string, tokenDoProvedor: string, nomeSugerido?: string) {
    const { subject, nome } = await this.verificarProvedor(provedor, tokenDoProvedor);

    const existente = await this.db.queryOne<{ user_id: string }>(
      `SELECT user_id FROM credentials WHERE provider = $1 AND subject = $2`,
      [provedor, subject],
    );
    if (existente) {
      return this.sessaoDe(existente.user_id);
    }

    const userId = `u-${randomBytes(9).toString('base64url')}`;
    await this.db.transaction(async (client) => {
      await client.query(`INSERT INTO users (id, name) VALUES ($1, $2)`, [
        userId,
        nome ?? nomeSugerido ?? 'Jogador',
      ]);
      await client.query(`INSERT INTO credentials (provider, subject, user_id) VALUES ($1, $2, $3)`, [
        provedor,
        subject,
        userId,
      ]);
    });
    return this.sessaoDe(userId);
  }

  /**
   * Confere com o Firebase que o token é legítimo. Aceita `google`, `apple` e
   * `facebook` — os três que o plano de produto pede.
   *
   * Se FIREBASE_SERVICE_ACCOUNT não estiver definida, isto recusa: aceitar sem
   * conferir seria pior do que não ter login social nenhum, porque bastaria inventar
   * um token pra entrar como qualquer pessoa.
   */
  private async verificarProvedor(
    provedor: string,
    token: string,
  ): Promise<{ subject: string; nome?: string }> {
    if (!PROVEDORES_ACEITOS.includes(provedor)) {
      throw new BadRequestException(
        `Provedor "${provedor}" não é aceito. Use: ${PROVEDORES_ACEITOS.join(', ')}.`,
      );
    }
    return verificarTokenFirebase(provedor, token);
  }

  /** Pra tela de login saber se mostra os botões de login social ou esconde. */
  provedoresDisponiveis(): string[] {
    return firebaseEstaLigado() ? [...PROVEDORES_ACEITOS] : [];
  }

  /** Confere o token e devolve o userId. Usado pelo guard e pelo gateway. */
  verificarToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.segredo) as TokenPayload;
      if (!payload?.sub) throw new Error('sem sub');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  private async sessaoDe(userId: string): Promise<{ token: string; user: User }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Conta não encontrada.');
    }
    const token = jwt.sign({ sub: userId } satisfies TokenPayload, this.segredo, {
      expiresIn: VALIDADE_TOKEN,
    });
    return { token, user };
  }
}

function normalizarEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = (await scryptAsync(senha, sal, 64)) as Buffer;
  return `${sal.toString('hex')}:${derivada.toString('hex')}`;
}

async function senhaConfere(senha: string, guardada: string): Promise<boolean> {
  const [salHex, hashHex] = guardada.split(':');
  if (!salHex || !hashHex) return false;
  const derivada = (await scryptAsync(senha, Buffer.from(salHex, 'hex'), 64)) as Buffer;
  const esperada = Buffer.from(hashHex, 'hex');
  // timingSafeEqual pelo mesmo motivo da assinatura do webhook da loja.
  return derivada.length === esperada.length && timingSafeEqual(derivada, esperada);
}
