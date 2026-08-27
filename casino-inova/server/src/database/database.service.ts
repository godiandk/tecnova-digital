import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A conexão com o Postgres e as duas coisas que todo serviço precisa dele: rodar uma
 * consulta e rodar um punhado delas dentro de uma transação.
 *
 * O endereço vem de DATABASE_URL. Não existe valor padrão apontando pra produção de
 * propósito — se a variável não estiver definida, o servidor não sobe, em vez de subir
 * gravando em algum lugar que ninguém escolheu.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    /*
     * BIGINT (oid 20) chega como string por padrão, porque um bigint do Postgres não
     * cabe no número do JavaScript. Aqui cabe: fichas e valores de ledger ficam muito
     * abaixo de 2^53, e devolver string faria toda soma virar concatenação de texto
     * silenciosamente. Converter na entrada é mais seguro do que lembrar de converter
     * em cada consulta.
     */
    types.setTypeParser(types.builtins.INT8, (valor) => Number(valor));

    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL não está definida. Ex: postgres://postgres@localhost:5432/casino_inova',
      );
    }
    this.pool = new Pool({ connectionString: url, max: 10 });
  }

  async onModuleInit() {
    await this.migrate();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Aplica o esquema. Tudo em `schema.sql` é `CREATE ... IF NOT EXISTS`, então rodar de
   * novo não faz mal — é o suficiente enquanto o esquema só cresce. Quando precisar
   * alterar coluna existente, aqui vira uma tabela de migrações numeradas.
   */
  private async migrate() {
    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await this.pool.query(sql);
    this.logger.log('Esquema aplicado.');
  }

  async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  /** Primeira linha, ou undefined. Atalho pro caso mais comum de leitura. */
  async queryOne<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(text, params);
    return rows[0];
  }

  /**
   * Roda `fn` numa transação: ou tudo dentro dela vale, ou nada vale.
   *
   * É o que sustenta a aposta — debitar a ficha e registrar a rodada precisam acontecer
   * juntos. Se der erro no meio, o ROLLBACK devolve o estado anterior e o jogador não
   * fica sem a ficha por causa de uma falha nossa.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }
}
