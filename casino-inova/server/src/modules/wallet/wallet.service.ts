import { Injectable, BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';

export type LedgerEntryType = 'compra' | 'aposta' | 'premio' | 'presente' | 'ajuste' | 'cupom' | 'suporte';

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  /** Positivo = crédito, negativo = débito. */
  amount: number;
  /** A chave da intenção do cliente, quando a operação veio de uma ação dele. */
  actionId?: string;
  /**
   * Verdadeiro quando esta entrada JÁ EXISTIA e foi devolvida em vez de criada — a
   * mesma ação chegou duas vezes. Quem chamou precisa saber pra não pagar de novo.
   */
  repetida?: boolean;
  /**
   * De onde veio a entrada: o id do jogo numa aposta ou prêmio de jogo, o id do
   * torneio num prêmio de torneio, o id do pacote numa compra. Serve pra pessoa
   * conseguir olhar o extrato e entender por que ganhou ou perdeu ficha — "Prêmio"
   * sozinho não explica nada; "Prêmio — Corrida do Dia" explica.
   */
  origin?: string;
  /**
   * A rodada que causou o movimento. A aposta e o prêmio da MESMA rodada carregam o
   * mesmo identificador — é o que deixa perguntar "quanto esta rodada custou e pagou"
   * sem adivinhar por horário.
   */
  roundId?: string;
  /**
   * O saldo imediatamente ANTES deste movimento, e o de DEPOIS. Sempre
   * `balanceAfter = balanceBefore + amount`.
   *
   * AUSENTES nas linhas anteriores à corrente existir. Devolver zero ali seria pior que
   * não devolver nada: um lançamento de 2026 apareceria como se o jogador tivesse saldo
   * zero antes e depois, e a conferência da corrente acusaria um buraco que nunca
   * existiu. Ausente é a verdade — aquele saldo não foi gravado na época.
   */
  balanceBefore?: number;
  balanceAfter?: number;
  createdAt: string;
}

/** O que acompanha um movimento além do valor. Tudo opcional; tudo vai pro extrato. */
export interface ContextoDoMovimento {
  origin?: string;
  actionId?: string;
  roundId?: string;
}

interface LinhaLedger {
  id: number;
  user_id: string;
  type: LedgerEntryType;
  amount: number;
  origin: string | null;
  action_id: string | null;
  round_id: string | null;
  balance_before: string | number | null;
  balance_after: string | number | null;
  created_at: Date;
}

/**
 * Ledger append-only: nenhuma entrada é editada ou apagada, só acrescentada, e o saldo
 * é sempre a SOMA de todas as entradas — nunca um campo sobrescrito. É o que permite
 * auditar de onde veio cada ficha, e o que impede um saldo "corrigido" na mão esconder
 * um erro de contabilidade.
 */
@Injectable()
export class WalletService {
  constructor(private readonly db: DatabaseService) {}

  async balanceOf(userId: string): Promise<number> {
    const linha = await this.db.queryOne<{ saldo: number }>(
      'SELECT COALESCE(SUM(amount), 0)::bigint AS saldo FROM ledger_entries WHERE user_id = $1',
      [userId],
    );
    return linha?.saldo ?? 0;
  }

  async historyOf(userId: string): Promise<LedgerEntry[]> {
    const linhas = await this.db.query<LinhaLedger>(
      'SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY id',
      [userId],
    );
    return linhas.map((linha) => paraEntrada(linha));
  }


  /**
   * Credita.
   *
   * PASSOU A TRAVAR A LINHA DO JOGADOR, como o débito já fazia. Não é ciúme de
   * simetria: agora cada movimento grava o saldo de ANTES e o de DEPOIS, e esses dois
   * números só são verdade se ninguém mexer no saldo entre a leitura e a gravação.
   * Sem a trava, dois créditos simultâneos leriam o mesmo "antes" e gravariam o mesmo
   * "depois" — a corrente do extrato quebraria em silêncio, que é exatamente o que ela
   * existe pra denunciar.
   */
  async credit(
    userId: string,
    amount: number,
    type: LedgerEntryType,
    origin?: string,
    actionId?: string,
    roundId?: string,
  ): Promise<LedgerEntry> {
    exigirFichaInteira(amount, 'crédito');
    return this.movimentar(userId, amount, type, { origin, actionId, roundId });
  }

  /**
   * Debita, se houver saldo.
   *
   * O detalhe que importa aqui: conferir o saldo e gravar o débito precisam ser uma
   * operação só. Ler o saldo, decidir, e só depois gravar deixa uma janela em que duas
   * apostas simultâneas do mesmo jogador leem o mesmo saldo, cada uma se acha
   * aprovada, e as duas gravam — o jogador aposta mais fichas do que tem. Enquanto
   * tudo vivia em memória num processo só isso não acontecia; com banco de verdade e
   * requisições concorrentes, acontece.
   *
   * A trava é o `SELECT ... FOR UPDATE` na linha do usuário: qualquer outro movimento
   * do MESMO jogador espera esta transação terminar antes de ler o saldo. Movimentos
   * de jogadores diferentes não se atrapalham, porque cada um trava a sua própria linha.
   */
  async debit(
    userId: string,
    amount: number,
    type: LedgerEntryType,
    origin?: string,
    actionId?: string,
    roundId?: string,
  ): Promise<LedgerEntry> {
    exigirFichaInteira(amount, 'débito');
    return this.movimentar(userId, -amount, type, { origin, actionId, roundId });
  }

  /**
   * O ÚNICO caminho por onde ficha entra ou sai. Crédito e débito são o mesmo
   * movimento com o sinal trocado.
   *
   * Era um caminho pra cada um, e os dois iam divergindo: o débito travava a linha e o
   * crédito não, o débito conferia idempotência dentro da transação e o crédito
   * dependia de uma restrição do banco. Duas implementações da mesma coisa é como se
   * perde uma delas de vista.
   *
   * A ORDEM AQUI É A REGRA, e cada passo depende do anterior:
   *
   *   1. Trava a linha do jogador. Daqui até o fim, mais ninguém mexe no saldo dele.
   *   2. Já foi feito? Com a linha travada, duas requisições iguais não conseguem ler
   *      "não existe" ao mesmo tempo. A segunda devolve a primeira, marcada.
   *   3. Lê o saldo. É o `balance_before` e é a base da conferência de saldo.
   *   4. Recusa débito que não cabe. Nunca existe saldo negativo.
   *   5. Grava, com antes e depois na própria linha.
   */
  private async movimentar(
    userId: string,
    valor: number,
    type: LedgerEntryType,
    contexto: ContextoDoMovimento,
  ): Promise<LedgerEntry> {
    if (!Number.isSafeInteger(valor) || valor === 0) {
      /*
       * Ficha é inteira, e um valor que não é inteiro seguro só chega aqui por erro de
       * conta em algum motor — NaN, Infinity, fração perdida num float. Recusar em vez
       * de arredondar é o que impede o erro virar dinheiro.
       */
      throw new BadRequestException('Movimento inválido: o valor precisa ser um inteiro diferente de zero.');
    }

    return this.db.transaction(async (client) => {
      const trancado = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (trancado.rowCount === 0) {
        throw new BadRequestException('Usuário não encontrado.');
      }

      if (contexto.actionId) {
        const { rows: jaFeito } = await client.query<LinhaLedger>(
          'SELECT * FROM ledger_entries WHERE user_id = $1 AND action_id = $2',
          [userId, contexto.actionId],
        );
        if (jaFeito.length > 0) return paraEntrada(jaFeito[0], true);
      }

      const { rows } = await client.query<{ saldo: string }>(
        'SELECT COALESCE(SUM(amount), 0)::bigint AS saldo FROM ledger_entries WHERE user_id = $1',
        [userId],
      );
      const antes = Number(rows[0]?.saldo ?? 0);
      const depois = antes + valor;

      if (depois < 0) {
        throw new BadRequestException('Saldo de fichas insuficiente.');
      }

      const inserido = await client.query<LinhaLedger>(
        `INSERT INTO ledger_entries
           (user_id, type, amount, origin, action_id, round_id, balance_before, balance_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          userId,
          type,
          valor,
          contexto.origin ?? null,
          contexto.actionId ?? null,
          contexto.roundId ?? null,
          antes,
          depois,
        ],
      );
      return paraEntrada(inserido.rows[0]);
    });
  }

  /**
   * Versão de dentro de uma transação já aberta, pra quando o débito precisa acontecer
   * junto com outra escrita (a rodada de torneio, por exemplo) e as duas têm que valer
   * ou falhar juntas.
   */
  async creditInTransaction(
    client: PoolClient,
    userId: string,
    amount: number,
    type: LedgerEntryType,
    origin?: string,
    roundId?: string,
  ): Promise<LedgerEntry> {
    exigirFichaInteira(amount, 'crédito');
    const valor = amount;
    /*
     * A TRAVA ENTRA AQUI TAMBÉM. Quem chama já abriu a transação, mas pode não ter
     * travado a linha do jogador — e sem a trava o saldo lido para o `balance_before`
     * pode mudar antes da gravação, quebrando a corrente do extrato. `FOR UPDATE`
     * repetido na mesma transação é barato: se já estiver travada, passa direto.
     */
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const { rows: saldo } = await client.query<{ saldo: string }>(
      'SELECT COALESCE(SUM(amount), 0)::bigint AS saldo FROM ledger_entries WHERE user_id = $1',
      [userId],
    );
    const antes = Number(saldo[0]?.saldo ?? 0);

    const { rows } = await client.query<LinhaLedger>(
      `INSERT INTO ledger_entries
         (user_id, type, amount, origin, round_id, balance_before, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, valor, origin ?? null, roundId ?? null, antes, antes + valor],
    );
    return paraEntrada(rows[0]);
  }
}

/**
 * A POLÍTICA DE ARREDONDAMENTO DO CASSINO, num lugar só: **a carteira não arredonda.**
 *
 * Ela recusa qualquer valor que não seja ficha inteira. Parece rigor inútil e não é:
 * antes disto a carteira fazia `Math.round`, e um prêmio de 100,4 virava 100 sem que
 * ninguém soubesse — a fração sumia todo dia, em toda rodada, sempre para o mesmo lado.
 * Isso é vantagem da casa não declarada, que é o contrário do que este jogo promete.
 *
 * Arredondar é decisão de REGRA DE JOGO, e cada motor toma a sua onde ela é visível e
 * pode ser explicada na tela ("o prêmio é truncado para baixo", "a comissão é arredondada
 * para cima"). O que não pode é a decisão acontecer aqui embaixo, escondida, onde
 * ninguém procura e nada documenta.
 */
export function exigirFichaInteira(valor: number, oQue: string): void {
  if (!Number.isFinite(valor)) {
    throw new BadRequestException(`O valor de um ${oQue} precisa ser um número.`);
  }
  if (!Number.isInteger(valor)) {
    throw new BadRequestException(
      `O valor de um ${oQue} precisa ser ficha inteira — ${valor} tem fração. ` +
        'Quem calcula decide como arredondar, e mostra a regra na tela.',
    );
  }
  if (!Number.isSafeInteger(valor)) {
    throw new BadRequestException(`O valor de um ${oQue} passou do inteiro seguro.`);
  }
  if (valor <= 0) {
    throw new BadRequestException(`O valor de um ${oQue} precisa ser maior que zero.`);
  }
}

function paraEntrada(linha: LinhaLedger, repetida = false): LedgerEntry {
  /*
   * O `pg` devolve BIGINT como TEXTO, pra não perder precisão acima de 2^53. Aqui os
   * valores cabem folgadamente num número, mas a conversão precisa ser explícita —
   * `'900' + 100` daria `'900100'`, e um saldo assim passaria despercebido.
   */
  const numero = (v: string | number | null): number | undefined => (v === null ? undefined : Number(v));
  return {
    id: String(linha.id),
    userId: linha.user_id,
    type: linha.type,
    amount: Number(linha.amount),
    origin: linha.origin ?? undefined,
    actionId: linha.action_id ?? undefined,
    roundId: linha.round_id ?? undefined,
    balanceBefore: numero(linha.balance_before),
    balanceAfter: numero(linha.balance_after),
    createdAt: linha.created_at.toISOString(),
    ...(repetida ? { repetida: true } : {}),
  };
}
