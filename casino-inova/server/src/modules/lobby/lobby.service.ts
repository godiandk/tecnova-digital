import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface GanhoRecente {
  jogador: string;
  jogo: string;
  /** Ganho LÍQUIDO: o prêmio menos a aposta que o gerou. Ver comentário da consulta. */
  valor: number;
  quando: string;
}

/** Só entra na fita ganho acima disso — senão a fita vira extrato. */
const VALOR_MINIMO = 500;

/** Nada mais velho que isto aparece: a fita serve pra dizer que a casa está viva agora. */
const JANELA_EM_HORAS = 24;

@Injectable()
export class LobbyService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Os maiores ganhos recentes, de verdade.
   *
   * Duas decisões que valem explicação, porque é onde esse tipo de painel costuma
   * mentir:
   *
   * 1. **O valor é líquido.** Um `premio` no ledger é o RETORNO TOTAL — quem aposta
   *    1.000 no blackjack e ganha recebe 2.000 de prêmio, mas só ganhou 1.000. Mostrar
   *    "ganhou 2.000" seria inflar o número em cima de uma ambiguidade. O LATERAL
   *    abaixo acha a aposta que gerou aquele prêmio (a última do mesmo jogador, no
   *    mesmo jogo, imediatamente antes) e subtrai.
   *
   * 2. **Ninguém é inventado.** Se não teve ganho grande nas últimas horas, a resposta
   *    vem vazia e a fita some da tela. É a diferença entre dizer que a casa está cheia
   *    e mostrar que ela está.
   */
  async ganhosRecentes(limite = 12): Promise<GanhoRecente[]> {
    const linhas = await this.db.query<{
      jogador: string;
      jogo: string;
      valor: number;
      quando: Date;
    }>(
      `SELECT u.name AS jogador,
              premio.origin AS jogo,
              (premio.amount + COALESCE(aposta.amount, 0))::bigint AS valor,
              premio.created_at AS quando
         FROM ledger_entries premio
         JOIN users u ON u.id = premio.user_id
         LEFT JOIN LATERAL (
              SELECT e.amount
                FROM ledger_entries e
               WHERE e.user_id = premio.user_id
                 AND e.type = 'aposta'
                 AND e.origin IS NOT DISTINCT FROM premio.origin
                 AND e.id < premio.id
               ORDER BY e.id DESC
               LIMIT 1
         ) aposta ON TRUE
        WHERE premio.type = 'premio'
          AND premio.created_at > now() - ($1 || ' hours')::interval
          -- amount da aposta é negativo, então somar é subtrair o que foi arriscado.
          AND (premio.amount + COALESCE(aposta.amount, 0)) >= $2
        ORDER BY (premio.amount + COALESCE(aposta.amount, 0)) DESC
        LIMIT $3`,
      [String(JANELA_EM_HORAS), VALOR_MINIMO, limite],
    );

    return linhas.map((linha) => ({
      jogador: linha.jogador,
      jogo: linha.jogo,
      valor: Number(linha.valor),
      quando: new Date(linha.quando).toISOString(),
    }));
  }
}
