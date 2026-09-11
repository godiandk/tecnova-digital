import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import type { Role } from '../roles/roles.constants';
import { DatabaseService } from '../../database/database.service';
import { registro } from '../../observabilidade/registro';
import { ProgressoDaRodada, XP_MAXIMO_POR_DIA, somarXp, xpDaRodada, xpDoNivel } from '../progressao/niveis';
import { nivelPara } from '../games/shared/niveis-de-mesa';
import { diaDoServidor } from '../../comum/dia-do-servidor';
import { gerarCodigoPublico, somenteDigitos } from './codigo-publico';
import { emailsDeAdmin } from '../roles/donos';

const scryptAsync = promisify(scrypt);

export interface User {
  id: string;
  /**
   * O número que a pessoa vê e diz pro suporte: oito dígitos, mostrados como 0000-0000.
   * O `id` acima é do banco; este é das pessoas.
   */
  publicCode: string;
  /** Qual retrato ela escolheu, por nome. A arte vem dentro do aplicativo. */
  avatar: string | null;
  name: string;
  level: number;
  xp: number;
  /**
   * Quanto XP este nível exige pra virar o próximo.
   *
   * Vai junto do usuário porque a curva é do servidor. Enquanto ela morava no app, duas
   * versões do aplicativo desenhavam barras diferentes pro mesmo XP — e nenhuma das
   * duas era a verdade.
   */
  xpToNextLevel: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  role: Role;
}

interface LinhaUsuario {
  id: string;
  public_code: string | null;
  avatar: string | null;
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

/*
 * A semente não escreve `xpToNextLevel`: esse campo é CALCULADO a partir do nível, e
 * guardar uma cópia dele numa lista à mão seria um segundo lugar pra ele ficar errado.
 */
const SEMENTE: Array<Omit<User, 'xpToNextLevel' | 'publicCode' | 'avatar'> & { fichasIniciais: number; email: string }> = [
  { id: 'u1', name: 'Convidado', level: 4, xp: 320, vipTier: 'prata', role: 'admin', fichasIniciais: 12_500, email: 'u1@teste.local' },
  { id: 'u2', name: 'Suporte Ana', level: 1, xp: 0, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u2@teste.local' },
  { id: 'u3', name: 'Teste Bruno', level: 2, xp: 40, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u3@teste.local' },
  { id: 'u4', name: 'Teste Carla', level: 2, xp: 60, vipTier: 'bronze', role: 'jogador', fichasIniciais: 0, email: 'u4@teste.local' },
];

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Promove os donos na subida do servidor.
   *
   * A promoção também acontece no login, mas isso não bastava pra quem JÁ ESTÁ LOGADO:
   * a sessão guardada é restaurada sem passar pelo login, então a conta ficaria como
   * jogador comum até a pessoa sair e entrar de novo — que é exatamente o que
   * aconteceu. Aqui, uma conta que já existe vira admin assim que a versão nova sobe.
   *
   * Roda em toda subida e não faz nada quando não há o que mudar: é um UPDATE que só
   * alcança quem está na lista e ainda não é admin.
   */
  async promoverDonos(): Promise<number> {
    const emails = emailsDeAdmin();
    if (emails.length === 0) return 0;

    const linhas = await this.db.query<{ id: string }>(
      `UPDATE users
          SET role = 'admin'
        WHERE role <> 'admin'
          AND id IN (SELECT user_id FROM credentials WHERE lower(subject) = ANY($1::text[]))
        RETURNING id`,
      [emails],
    );
    return linhas.length;
  }

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
    if (!linha) return undefined;
    if (!linha.public_code) return paraUsuario(await this.garantirCodigo(linha));
    return paraUsuario(linha);
  }

  /**
   * Dá um código público a quem ainda não tem.
   *
   * Acontece de dois jeitos: numa conta criada antes desta coluna existir, e — em
   * teoria — se dois cadastros simultâneos sorteassem o mesmo número. O laço trata os
   * dois iguais, tentando de novo. O índice único no banco é quem realmente garante que
   * não existem dois códigos iguais; este código só reage à recusa dele.
   */
  private async garantirCodigo(linha: LinhaUsuario): Promise<LinhaUsuario> {
    for (let tentativa = 0; tentativa < 12; tentativa += 1) {
      try {
        const atualizada = await this.db.queryOne<LinhaUsuario>(
          'UPDATE users SET public_code = $2 WHERE id = $1 AND public_code IS NULL RETURNING *',
          [linha.id, gerarCodigoPublico()],
        );
        // Nulo aqui = outra chamada já deu um código pra esta conta. Lê o que ficou.
        if (!atualizada) {
          return (await this.db.queryOne<LinhaUsuario>('SELECT * FROM users WHERE id = $1', [linha.id])) ?? linha;
        }
        return atualizada;
      } catch {
        // Código repetido: o índice único recusou. Sorteia outro.
      }
    }
    return linha;
  }

  /**
   * Muda o apelido e o retrato.
   *
   * O nome é aparado e limitado a 20 caracteres porque ele aparece no assento da mesa,
   * no ranking e no chat — um nome de 300 letras não é expressão pessoal, é a mesa dos
   * outros quebrada. Vazio é recusado em vez de virar um assento sem nome.
   */
  async atualizarPerfil(userId: string, dados: { name?: string; avatar?: string | null }): Promise<User> {
    const nome = dados.name?.trim();
    if (dados.name !== undefined && (!nome || nome.length < 2)) {
      throw new NotFoundException('O apelido precisa ter pelo menos 2 letras.');
    }

    const linha = await this.db.queryOne<LinhaUsuario>(
      `UPDATE users
          SET name   = COALESCE($2, name),
              avatar = COALESCE($3, avatar)
        WHERE id = $1
        RETURNING *`,
      [userId, nome ? nome.slice(0, 20) : null, dados.avatar ?? null],
    );
    if (!linha) throw new NotFoundException('Usuário não encontrado.');
    return paraUsuario(linha);
  }

  /**
   * Acha alguém pelo e-mail de login, pelo id ou pelo código público.
   *
   * O painel precisa disto porque NINGUÉM SABE O PRÓPRIO ID. O id é `u-` com nove bytes
   * em base64 — quem pede ajuda no suporte diz o e-mail com que entrou, não isso. Sem
   * busca por e-mail, dar fichas pra alguém exigiria ir no banco procurar antes.
   *
   * Procura em `credentials` porque é lá que o e-mail mora: a tabela `users` guarda quem
   * a pessoa é no jogo, e `credentials` guarda por onde ela entra — a mesma conta pode
   * ter senha e Google, com e-mails diferentes, e as duas devem achar.
   */
  async findByEmailOrId(termo: string): Promise<User | undefined> {
    const limpo = (termo ?? '').trim();
    if (!limpo) return undefined;

    const porId = await this.findById(limpo);
    if (porId) return porId;

    // Código público: aceita com traço, com espaço ou colado — quem digita não devia
    // ter que se preocupar com o formato.
    const digitos = somenteDigitos(limpo);
    if (digitos.length === 8) {
      const porCodigo = await this.db.queryOne<LinhaUsuario>(
        'SELECT * FROM users WHERE public_code = $1',
        [digitos],
      );
      if (porCodigo) return paraUsuario(porCodigo);
    }

    const credencial = await this.db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM credentials WHERE lower(subject) = lower($1) LIMIT 1',
      [limpo],
    );
    return credencial ? this.findById(credencial.user_id) : undefined;
  }

  /** Os e-mails por onde esta conta entra. O painel mostra pra confirmar que é a pessoa certa. */
  async emailsDe(userId: string): Promise<string[]> {
    const linhas = await this.db.query<{ subject: string; provider: string }>(
      'SELECT subject, provider FROM credentials WHERE user_id = $1 ORDER BY provider',
      [userId],
    );
    return linhas.map((linha) => linha.subject);
  }

  async list(): Promise<User[]> {
    const linhas = await this.db.query<LinhaUsuario>('SELECT * FROM users ORDER BY id');
    return linhas.map(paraUsuario);
  }

  /**
   * O XP DE UMA RODADA QUE ACABOU — o único caminho pelo qual jogar vira nível.
   *
   * A BARRA JÁ ANDAVA — `recordRound` é o funil por onde os dez jogos e as três salas
   * passam, e ele já somava XP. O que estava errado era QUANTO cada rodada valia. A conta
   * antiga olhava só o número de fichas apostadas, e número de fichas depende do degrau em
   * que a pessoa está: quem comprou fichas e subiu de mesa apostava mais fichas pela mesma
   * jogada e subia de nível mais rápido. A barra virava um placar de quanto se gastou.
   *
   * E não havia teto nenhum por dia, então tempo de máquina valia nível: quem automatizasse
   * a aposta mínima passava na frente de quem joga.
   *
   * POR QUE A CONTA INTEIRA MORA AQUI DENTRO. Ela precisa de três coisas que só existem
   * juntas dentro da transação: o nível e o XP de agora, o quanto já subiu hoje, e o
   * degrau da pessoa. Calcular o XP fora e passar um número pronto abriria a porta que
   * este projeto fecha em todo lugar — um valor decidido em outro lugar e aceito aqui sem
   * conferir. Quem chama passa o que ACONTECEU (apostou tanto, com tanto no bolso); quem
   * decide quanto isso vale é este método.
   *
   * O SALDO É O DE ANTES DA RODADA, e isso não é detalhe. Se fosse o de depois, quem
   * apostasse tudo e perdesse cairia pro degrau Bronze na hora — e a mesma aposta, medida
   * contra um mínimo de 50 em vez do mínimo do degrau real, renderia o XP máximo. O jogo
   * pagaria um bônus de barra por quebrar. Com o saldo de antes, quebrar não rende nada.
   *
   * O TETO DIÁRIO É APLICADO AQUI, dentro do mesmo `FOR UPDATE` que lê o XP, porque ele é
   * uma condição de corrida esperando pra acontecer: um robô disparando cinquenta rodadas
   * ao mesmo tempo leria cinquenta vezes o mesmo "já ganhei X hoje" e passaria do teto
   * cinquenta vezes. A linha travada faz a segunda rodada esperar a primeira.
   */
  async somarExperienciaDaRodada(
    userId: string,
    apostado: number,
    saldoAntesDaRodada: number,
    hoje = diaDoServidor(),
  ): Promise<ProgressoDaRodada | null> {
    if (!Number.isFinite(apostado) || apostado <= 0) return null;

    /*
     * UM SALDO QUE NÃO SE SUSTENTA NÃO PODE VALER XP CHEIO, e a direção do erro é a razão.
     * Saldo alto = degrau alto = mínimo alto = MENOS XP pela mesma ficha. Então quem quer
     * fraudar isto quer o saldo BAIXO — e um saldo zerado que escapou do caminho normal
     * (um assento que não passou pelo débito, um jogo novo passando a variável errada)
     * renderia o XP máximo em toda rodada, silenciosamente.
     *
     * A conferência é a única que sempre vale: ninguém aposta mais do que tinha. Quando o
     * número não passa por ela, o XP vira o piso — a rodada conta, mas não paga. E fica
     * registrado, porque isto é defeito de programação, não jogada de jogador.
     */
    if (!Number.isFinite(saldoAntesDaRodada) || saldoAntesDaRodada < apostado) {
      registro.aviso('progressao', 'saldo-antes-nao-confere', {
        apostado,
        saldoAntesDaRodada,
        porque: 'o saldo de antes da rodada é menor que a aposta — XP pago no piso',
      });
      return this.gravarExperiencia(userId, 1, hoje);
    }

    /*
     * O DIVISOR É O MÍNIMO DO DEGRAU DA PESSOA, e é ele que impede dinheiro de virar
     * nível: o Bronze apostando 20x o mínimo dele e o Eclipse apostando 20x o mínimo dele
     * ganham exatamente o mesmo XP. Ver `verify-xp.ts`, conferência 1.
     */
    const minimoDoDegrau = nivelPara(saldoAntesDaRodada).minimo;
    const ganhoCheio = xpDaRodada(apostado, minimoDoDegrau);
    if (ganhoCheio <= 0) return null;

    return this.gravarExperiencia(userId, ganhoCheio, hoje);
  }

  /**
   * Grava o XP já calculado, aplicando o teto do dia, tudo numa transação só.
   *
   * Separado de `somarExperienciaDaRodada` porque o teto e a corrida pela linha são a
   * mesma coisa nos dois caminhos (o normal e o do piso), e duplicar um `FOR UPDATE` é
   * duplicar o lugar onde uma condição de corrida pode nascer.
   */
  private async gravarExperiencia(
    userId: string,
    ganhoCheio: number,
    hoje: string,
  ): Promise<ProgressoDaRodada | null> {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<{ level: number; xp: number; xp_do_dia: number; xp_do_dia_em: string | null }>(
        'SELECT level, xp, xp_do_dia, xp_do_dia_em FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      if (rows.length === 0) return null;

      /*
       * O contador se zera sozinho: se o dia gravado não é hoje, o que está lá é de
       * ontem. Sem isto seria preciso uma tarefa agendada zerando a coluna de todo mundo
       * à meia-noite — trabalho recorrente que falha em silêncio quando o processo está
       * fora do ar.
       */
      const jaHoje = normalizarDia(rows[0].xp_do_dia_em) === hoje ? Math.max(0, rows[0].xp_do_dia) : 0;
      const cabe = Math.max(0, XP_MAXIMO_POR_DIA - jaHoje);
      const ganho = Math.min(ganhoCheio, cabe);

      /*
       * Bateu no teto: nada muda, mas o dia fica gravado. Devolver o progresso parado (e
       * não `null`) é o que permite à tela dizer "você já alcançou o máximo de hoje" em
       * vez de simplesmente não mexer a barra e deixar a pessoa achando que travou.
       */
      if (ganho <= 0) {
        await client.query('UPDATE users SET xp_do_dia = $2, xp_do_dia_em = $3 WHERE id = $1', [userId, jaHoje, hoje]);
        return {
          level: rows[0].level,
          xp: rows[0].xp,
          xpToNextLevel: xpDoNivel(rows[0].level),
          subiuNiveis: 0,
          noTopo: false,
          ganho: 0,
          xpDoDia: jaHoje,
          noTetoDoDia: true,
        };
      }

      const progresso = somarXp(rows[0].level, rows[0].xp, ganho);
      await client.query(
        'UPDATE users SET level = $2, xp = $3, xp_do_dia = $4, xp_do_dia_em = $5 WHERE id = $1',
        [userId, progresso.level, progresso.xp, jaHoje + ganho, hoje],
      );
      return { ...progresso, ganho, xpDoDia: jaHoje + ganho, noTetoDoDia: jaHoje + ganho >= XP_MAXIMO_POR_DIA };
    });
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

/**
 * A coluna `DATE` volta do driver como `Date` ou como texto, conforme a configuração do
 * `pg`. Os dois viram `AAAA-MM-DD` aqui, e nenhum passa por fuso local no caminho — um
 * `Date` reinterpretado no fuso da máquina perde um dia em metade do planeta.
 */
function normalizarDia(valor: string | Date | null): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function paraUsuario(linha: LinhaUsuario): User {
  return {
    id: linha.id,
    name: linha.name,
    publicCode: linha.public_code ?? '',
    avatar: linha.avatar,
    level: linha.level,
    xp: linha.xp,
    xpToNextLevel: xpDoNivel(linha.level),
    vipTier: linha.vip_tier,
    role: linha.role,
  };
}
