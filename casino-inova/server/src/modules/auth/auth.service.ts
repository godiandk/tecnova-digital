import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { PoolClient } from 'pg';
import { promisify } from 'util';
import * as jwt from 'jsonwebtoken';
import { ehEmailDeAdmin } from '../roles/donos';
import { lerNascimento } from '../legal/idade';
import { VERSAO_DOS_TERMOS } from '../legal/termos';
import { DatabaseService } from '../../database/database.service';
import { UsersService, User } from '../users/users.service';
import { firebaseEstaLigado, verificarTokenFirebase } from './firebase';

const scryptAsync = promisify(scrypt);

/** Quanto tempo o token vale. Curto o bastante pra um vazamento não ser eterno. */
const VALIDADE_TOKEN = '30d';

/**
 * Quais logins sociais este servidor aceita.
 *
 * Vem de FIREBASE_PROVIDERS (lista separada por vírgula) porque precisa bater com o que
 * está de fato LIGADO no console do Firebase. Anunciar um provedor que o projeto não tem
 * faz o app mostrar um botão que sempre dá erro — pior do que não mostrar botão.
 *
 * O padrão é só `google`: é o único que dá pra ligar sem conta paga. Apple exige o Apple
 * Developer Program, e Facebook exige um app criado no developers.facebook.com.
 */
const PROVEDORES_CONHECIDOS = ['google', 'apple', 'facebook'];

function provedoresConfigurados(): string[] {
  const bruto = process.env.FIREBASE_PROVIDERS;
  if (!bruto) return ['google'];
  return bruto
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => PROVEDORES_CONHECIDOS.includes(item));
}

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
/**
 * Fichas que toda conta nova recebe.
 *
 * Sem isso a conta nasce com saldo zero e não dá pra fazer NADA: o app abre, os dez
 * jogos aparecem abertos, e qualquer aposta é recusada por saldo insuficiente. Não é
 * promoção nem isca — é o mínimo pro produto funcionar, e todo cassino social entrega
 * uma pilha inicial pelo mesmo motivo.
 *
 * Entra como lançamento no ledger, do tipo `presente`, e não como número guardado na
 * conta: o saldo continua sendo a SOMA das entradas, e essa aparece no extrato como
 * qualquer outra.
 */
export const FICHAS_DE_BOAS_VINDAS = 10_000;

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

  async registrarComSenha(
    email: string,
    senha: string,
    nome: string,
    dados?: { nascimento?: string; nomeCompleto?: string; aceitouTermos?: boolean },
  ) {
    const emailNormalizado = normalizarEmail(email);
    if (!emailNormalizado.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }
    if (!senha || senha.length < 8) {
      throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
    }
    if (!nome?.trim()) {
      throw new BadRequestException('Informe um apelido.');
    }

    /*
     * A IDADE E O ACEITE SÃO CONFERIDOS AQUI, NO SERVIDOR.
     *
     * O aplicativo avisa antes pra a pessoa não preencher o resto à toa, mas quem recusa
     * é este ponto: no aplicativo bastaria mudar o relógio do telefone, ou mandar outro
     * número na requisição.
     *
     * `nascimento` é opcional no tipo por causa das contas que já existem e das que
     * entram por Google — mas no cadastro por senha ele é obrigatório, e a linha abaixo
     * recusa quando falta.
     */
    const nascimento = lerNascimento(dados?.nascimento);
    if ('erro' in nascimento) throw new BadRequestException(nascimento.erro);

    if (dados?.aceitouTermos !== true) {
      throw new BadRequestException('É preciso aceitar os termos de uso e a política de privacidade.');
    }

    const nomeCompleto = dados?.nomeCompleto?.trim();
    if (!nomeCompleto || nomeCompleto.length < 3) {
      throw new BadRequestException('Informe seu nome completo.');
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
      await client.query(
        `INSERT INTO users (id, name, legal_name, birth_date, terms_accepted_at, terms_version)
         VALUES ($1, $2, $3, $4, now(), $5)`,
        [userId, nome.trim().slice(0, 20), nomeCompleto.slice(0, 120), nascimento.data, VERSAO_DOS_TERMOS],
      );
      await client.query(
        `INSERT INTO credentials (provider, subject, user_id, password_hash) VALUES ('senha', $1, $2, $3)`,
        [emailNormalizado, userId, hash],
      );
      await creditarBoasVindas(client, userId);
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
      await creditarBoasVindas(client, userId);
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
    const aceitos = provedoresConfigurados();
    if (!aceitos.includes(provedor)) {
      throw new BadRequestException(
        `Provedor "${provedor}" não está ligado neste servidor. Ligados: ${aceitos.join(', ') || 'nenhum'}.`,
      );
    }
    return verificarTokenFirebase(provedor, token);
  }

  /** Pra tela de login saber quais botões mostrar. Vazio = nenhum botão social. */
  provedoresDisponiveis(): string[] {
    return firebaseEstaLigado() ? provedoresConfigurados() : [];
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

  /**
   * Quem está na lista de donos entra como admin.
   *
   * Chamado de `sessaoDe` porque é o funil por onde TODA entrada passa — cadastro,
   * login com senha e login social. Num lugar só, não tem caminho pra esquecer.
   *
   * A ordem importa: isto roda DEPOIS de a identidade estar provada, nunca antes. Estar
   * na lista não abre porta nenhuma, não cria conta e não pula senha; só ajusta o papel
   * de quem já entrou pelos próprios meios.
   *
   * E só PROMOVE, nunca rebaixa: tirar um e-mail da lista não derruba ninguém que tenha
   * virado admin por outro caminho.
   */
  private async garantirDono(userId: string): Promise<void> {
    const credenciais = await this.db.query<{ subject: string }>(
      `SELECT subject FROM credentials WHERE user_id = $1`,
      [userId],
    );
    if (!credenciais.some((linha) => ehEmailDeAdmin(linha.subject))) return;

    const usuario = await this.users.findById(userId);
    if (!usuario || usuario.role === 'admin') return;

    await this.users.updateRole(userId, 'admin');
  }

  private async sessaoDe(userId: string): Promise<{ token: string; user: User }> {
    await this.garantirDono(userId);

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

/**
 * Lança as fichas de boas-vindas DENTRO da transação que cria a conta.
 *
 * Junto de propósito: se o lançamento falhasse depois, existiria conta sem fichas e
 * ninguém saberia. Ou nasce com saldo, ou não nasce.
 */
async function creditarBoasVindas(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1, 'presente', $2, 'boas-vindas')`,
    [userId, FICHAS_DE_BOAS_VINDAS],
  );
}
