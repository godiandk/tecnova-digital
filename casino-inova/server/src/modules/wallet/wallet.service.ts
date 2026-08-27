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
  /**
   * De onde veio a entrada: o id do jogo numa aposta ou prêmio de jogo, o id do
   * torneio num prêmio de torneio, o id do pacote numa compra. Serve pra pessoa
   * conseguir olhar o extrato e entender por que ganhou ou perdeu ficha — "Prêmio"
   * sozinho não explica nada; "Prêmio — Corrida do Dia" explica.
   */
  origin?: string;
  createdAt: string;
}

interface LinhaLedger {
  id: number;
  user_id: string;
  type: LedgerEntryType;
  amount: number;
  origin: string | null;
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
    return linhas.map(paraEntrada);
  }

  async credit(userId: string, amount: number, type: LedgerEntryType, origin?: string): Promise<LedgerEntry> {
    if (amount <= 0) {
      throw new BadRequestException('O valor de um crédito precisa ser maior que zero.');
    }
    const linha = await this.db.queryOne<LinhaLedger>(
      `INSERT INTO ledger_entries (user_id, type, amount, origin)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, Math.round(amount), origin ?? null],
    );
    return paraEntrada(linha!);
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
   * A trava é o `SELECT ... FOR UPDATE` na linha do usuário: qualquer outro débito do
   * MESMO jogador espera esta transação terminar antes de ler o saldo. Débitos de
   * jogadores diferentes não se atrapalham, porque cada um trava a sua própria linha.
   */
  async debit(userId: string, amount: number, type: LedgerEntryType, origin?: string): Promise<LedgerEntry> {
    if (amount <= 0) {
      throw new BadRequestException('O valor de um débito precisa ser maior que zero.');
    }
    const valor = Math.round(amount);

    return this.db.transaction(async (client) => {
      const trancado = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (trancado.rowCount === 0) {
        throw new BadRequestException('Usuário não encontrado.');
      }

      const { rows } = await client.query<{ saldo: number }>(
        'SELECT COALESCE(SUM(amount), 0)::bigint AS saldo FROM ledger_entries WHERE user_id = $1',
        [userId],
      );
      if ((rows[0]?.saldo ?? 0) < valor) {
        throw new BadRequestException('Saldo de fichas insuficiente.');
      }

      const inserido = await client.query<LinhaLedger>(
        `INSERT INTO ledger_entries (user_id, type, amount, origin)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, type, -valor, origin ?? null],
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
  ): Promise<LedgerEntry> {
    const { rows } = await client.query<LinhaLedger>(
      `INSERT INTO ledger_entries (user_id, type, amount, origin)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, Math.round(amount), origin ?? null],
    );
    return paraEntrada(rows[0]);
  }
}

function paraEntrada(linha: LinhaLedger): LedgerEntry {
  return {
    id: String(linha.id),
    userId: linha.user_id,
    type: linha.type,
    amount: linha.amount,
    origin: linha.origin ?? undefined,
    createdAt: linha.created_at.toISOString(),
  };
}
