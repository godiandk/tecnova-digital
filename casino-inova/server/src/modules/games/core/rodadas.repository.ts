import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../../database/database.service';
import type { FaseDaRodada } from '../../../protocolo';
import { VERSAO_DO_PROTOCOLO, versaoDaRegra } from './versoes';

/**
 * A RODADA GUARDADA — o que aconteceu, e não só quanto custou.
 *
 * O extrato responde "saiu 100, entrou 0". Isto responde "por quê": qual rodada, com
 * qual regra, quem apostou onde, o que os dados deram, em que ordem, e quando. É a
 * diferença entre investigar uma reclamação e acreditar em quem gritar mais alto.
 *
 * A ORDEM DOS EVENTOS É O CORAÇÃO DISTO, e ela não pode depender de relógio nem de
 * memória. `seq` é um contador por rodada, atribuído DENTRO da transação que grava o
 * evento, com a linha da rodada travada (`FOR UPDATE`) — o mesmo padrão da carteira, e
 * pela mesma razão. Duas conexões gravando ao mesmo tempo não conseguem tirar o mesmo
 * número, e a chave primária `(rodada_id, seq)` é a última defesa se alguém tentar.
 *
 * Assim "o evento 17 veio depois do 16" continua verdade depois de o processo
 * reiniciar, depois de um backup restaurado, e depois de duas máquinas gravando na
 * mesma base.
 */

export interface RodadaGuardada {
  id: string;
  jogo: string;
  mesa: string | null;
  estado: FaseDaRodada;
  versaoDaRegra: string;
  versaoDoProtocolo: number;
  resultado: unknown | null;
  abertaEm: string;
  apostasFechadasEm: string | null;
  decididaEm: string | null;
  fechadaEm: string | null;
}

export interface EventoGuardado {
  seq: number;
  tipo: string;
  usuarioId: string | null;
  em: string;
  dados: Record<string, unknown>;
}

/** O que `reconstruir` devolve: a rodada e tudo que aconteceu nela, em ordem. */
export interface RodadaReconstruida {
  rodada: RodadaGuardada;
  eventos: EventoGuardado[];
}

interface LinhaDaRodada {
  id: string;
  jogo: string;
  mesa: string | null;
  estado: string;
  versao_da_regra: string;
  versao_do_protocolo: number;
  resultado: unknown | null;
  aberta_em: Date;
  apostas_fechadas_em: Date | null;
  decidida_em: Date | null;
  fechada_em: Date | null;
}

interface LinhaDoEvento {
  seq: number;
  tipo: string;
  usuario_id: string | null;
  em: Date;
  dados: Record<string, unknown>;
}

const emTexto = (d: Date | null): string | null => (d ? d.toISOString() : null);

@Injectable()
export class RodadasRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Abre a rodada no banco. Idempotente por `id`: chamar duas vezes com o mesmo
   * identificador não cria a segunda nem apaga a primeira.
   *
   * A idempotência aqui não é luxo. Uma reconexão que reenvia o pedido de abrir, ou um
   * `retry` depois de um tempo esgotado, criariam uma rodada gêmea — e aí existiriam
   * duas verdades sobre o mesmo momento, que é exatamente o que esta tabela veio evitar.
   */
  async abrir(entrada: {
    id: string;
    jogo: string;
    mesa?: string | null;
    estado: FaseDaRodada;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO rodadas (id, jogo, mesa, estado, versao_da_regra, versao_do_protocolo)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        entrada.id,
        entrada.jogo,
        entrada.mesa ?? null,
        entrada.estado,
        versaoDaRegra(entrada.jogo),
        VERSAO_DO_PROTOCOLO,
      ],
    );
  }

  /**
   * Move a rodada de fase e carimba o horário do marco correspondente.
   *
   * Os carimbos são gravados por COALESCE: o primeiro vale. Uma fase revisitada — e a
   * Banca Francesa revisita, porque o lançamento nulo volta de SORTEIO pra
   * APOSTAS_ABERTAS — não pode reescrever a hora em que a rodada abriu.
   */
  async mudarEstado(
    id: string,
    estado: FaseDaRodada,
    marcos: { apostasFechadas?: boolean; decidida?: boolean; fechada?: boolean; resultado?: unknown } = {},
  ): Promise<void> {
    await this.db.query(
      `UPDATE rodadas SET
         estado = $2,
         atualizada_em = now(),
         apostas_fechadas_em = CASE WHEN $3 THEN COALESCE(apostas_fechadas_em, now()) ELSE apostas_fechadas_em END,
         decidida_em         = CASE WHEN $4 THEN COALESCE(decidida_em, now())         ELSE decidida_em END,
         fechada_em          = CASE WHEN $5 THEN COALESCE(fechada_em, now())          ELSE fechada_em END,
         resultado           = COALESCE($6::jsonb, resultado)
       WHERE id = $1`,
      [
        id,
        estado,
        Boolean(marcos.apostasFechadas),
        Boolean(marcos.decidida),
        Boolean(marcos.fechada),
        marcos.resultado === undefined ? null : JSON.stringify(marcos.resultado),
      ],
    );
  }

  /**
   * Anota um evento e devolve o número dele.
   *
   * O número sai de dentro da transação, com a rodada travada. Ver o comentário do topo
   * do arquivo: é isto que faz a ordem sobreviver a um reinício.
   *
   * `dados` é o conteúdo do evento e vai como está. Quem chama é responsável por não
   * pôr aí nada que não precise existir — e-mail, token, endereço de rede ou carta
   * privada de outro jogador não entram, porque este log é lido no suporte e sai em
   * backup.
   */
  async anotar(
    rodadaId: string,
    evento: { tipo: string; usuarioId?: string | null; dados?: Record<string, unknown> },
    cliente?: PoolClient,
  ): Promise<number> {
    const gravar = async (c: PoolClient): Promise<number> => {
      /* Trava a rodada: quem mais quiser um número espera aqui, em vez de tirar o mesmo. */
      await c.query('SELECT id FROM rodadas WHERE id = $1 FOR UPDATE', [rodadaId]);
      const { rows } = await c.query<{ seq: number }>(
        `INSERT INTO eventos_da_rodada (rodada_id, seq, tipo, usuario_id, dados)
         VALUES ($1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM eventos_da_rodada WHERE rodada_id = $1), $2, $3, $4)
         RETURNING seq`,
        [rodadaId, evento.tipo, evento.usuarioId ?? null, JSON.stringify(evento.dados ?? {})],
      );
      return rows[0].seq;
    };
    return cliente ? gravar(cliente) : this.db.transaction(gravar);
  }

  /** A rodada e todos os eventos dela, em ordem de `seq`. É o replay. */
  async reconstruir(id: string): Promise<RodadaReconstruida | null> {
    const linha = await this.db.queryOne<LinhaDaRodada>('SELECT * FROM rodadas WHERE id = $1', [id]);
    if (!linha) return null;
    const eventos = await this.db.query<LinhaDoEvento>(
      'SELECT seq, tipo, usuario_id, em, dados FROM eventos_da_rodada WHERE rodada_id = $1 ORDER BY seq',
      [id],
    );
    return {
      rodada: {
        id: linha.id,
        jogo: linha.jogo,
        mesa: linha.mesa,
        estado: linha.estado as FaseDaRodada,
        versaoDaRegra: linha.versao_da_regra,
        versaoDoProtocolo: linha.versao_do_protocolo,
        resultado: linha.resultado,
        abertaEm: linha.aberta_em.toISOString(),
        apostasFechadasEm: emTexto(linha.apostas_fechadas_em),
        decididaEm: emTexto(linha.decidida_em),
        fechadaEm: emTexto(linha.fechada_em),
      },
      eventos: eventos.map((e) => ({
        seq: e.seq,
        tipo: e.tipo,
        usuarioId: e.usuario_id,
        em: e.em.toISOString(),
        dados: e.dados,
      })),
    };
  }

  /**
   * As rodadas que não fecharam — o que ficou preso quando o servidor caiu.
   *
   * É por aqui que a recuperação começa depois de um reinício: o servidor pergunta o que
   * estava no ar, em vez de inventar uma rodada nova por cima de apostas que já existem.
   */
  async abertas(jogo?: string): Promise<RodadaGuardada[]> {
    const linhas = await this.db.query<LinhaDaRodada>(
      `SELECT * FROM rodadas
       WHERE fechada_em IS NULL ${jogo ? 'AND jogo = $1' : ''}
       ORDER BY aberta_em`,
      jogo ? [jogo] : [],
    );
    return linhas.map((linha) => ({
      id: linha.id,
      jogo: linha.jogo,
      mesa: linha.mesa,
      estado: linha.estado as FaseDaRodada,
      versaoDaRegra: linha.versao_da_regra,
      versaoDoProtocolo: linha.versao_do_protocolo,
      resultado: linha.resultado,
      abertaEm: linha.aberta_em.toISOString(),
      apostasFechadasEm: emTexto(linha.apostas_fechadas_em),
      decididaEm: emTexto(linha.decidida_em),
      fechadaEm: emTexto(linha.fechada_em),
    }));
  }
}
