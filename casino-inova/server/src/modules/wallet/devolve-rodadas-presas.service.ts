import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from './wallet.service';
import { RodadasRepository } from '../games/core/rodadas.repository';
import { registro } from '../../observabilidade/registro';

/**
 * O QUE FICOU PRESO VOLTA PRO JOGADOR.
 *
 * O BURACO, e ele é de dinheiro: as mesas de turno (blackjack, truco, dominó, pôquer)
 * guardam a partida EM MEMÓRIA, e a aposta sai do saldo antes de a partida acabar. Se o
 * processo morre no meio — deploy, reinício, falta de energia —, a partida some e a ficha
 * não volta. O jogador apostou, não jogou, e perdeu. Não tem tela onde reclamar disso,
 * porque do lado dele parece só "sumiram minhas fichas".
 *
 * A REGRA: uma rodada que ficou aberta, com débito e sem liquidação, tem o débito
 * devolvido. Não é prêmio nem bondade — é desfazer uma cobrança por um serviço que não
 * foi entregue.
 *
 * POR QUE NO ARRANQUE, E NÃO A PEDIDO DO JOGADOR: uma devolução a pedido seria exploração
 * imediata. No blackjack o jogador vê as cartas ANTES de decidir; se pudesse desistir e
 * receber a aposta de volta ao ver uma mão ruim, a casa perderia sempre e o jogo
 * deixaria de ser jogo. Reinício do servidor, ao contrário, não é coisa que o jogador
 * provoque nem escolha — é justamente o caso em que ninguém consegue provar o resultado,
 * e a única saída honesta é devolver.
 *
 * A JANELA DE CARÊNCIA existe pra não devolver rodada VIVA. No arranque nenhuma está viva
 * (a memória acabou de nascer vazia), mas este serviço também pode ser chamado com o
 * servidor no ar — e aí uma rodada de dois segundos atrás é uma rodada em andamento.
 *
 * IDEMPOTENTE POR CONSTRUÇÃO: a devolução leva `actionId = devolucao:<rodada>`, e o índice
 * único `(user_id, action_id)` faz a segunda tentativa devolver a mesma linha em vez de
 * pagar de novo. Rodar isto duas vezes seguidas não paga duas vezes.
 */
@Injectable()
export class DevolveRodadasPresas implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly rodadas: RodadasRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    /*
     * NÃO DERRUBA O SERVIDOR SE FALHAR. Um banco fora do ar no arranque é problema, mas
     * não é problema DESTE serviço: quem cuida disso é a conexão. O que não pode é o
     * casino inteiro não subir porque uma devolução não deu certo — a rodada continua
     * presa e visível em `/roles/rodadas-abertas`, e a próxima subida tenta de novo.
     */
    try {
      const devolvidas = await this.devolver();
      if (devolvidas.length > 0) {
        registro.info('rodadas-presas', 'devolvidas no arranque', {
          quantas: devolvidas.length,
          total: devolvidas.reduce((soma, d) => soma + d.valor, 0),
        });
      }
    } catch (erro) {
      registro.erro('rodadas-presas', 'não deu pra devolver no arranque', { erro: (erro as Error).message });
    }
  }

  /**
   * Devolve o que ficou preso e fecha as rodadas. Devolve a lista do que foi devolvido.
   *
   * @param carenciaEmMinutos rodada mais nova que isto é considerada EM ANDAMENTO e não
   *   é tocada. No arranque qualquer valor serve (a memória está vazia); com o servidor
   *   no ar, é o que separa "presa" de "sendo jogada agora".
   */
  async devolver(carenciaEmMinutos = 10): Promise<Array<{ rodadaId: string; userId: string; valor: number }>> {
    /*
     * A CONTA É A SOMA DO EXTRATO DAQUELA RODADA, e não "o valor da aposta".
     *
     * Uma mão de blackjack pode ter aposta, dobra, divisão e seguro — quatro débitos —, e
     * uma banca francesa pode ter várias apostas na mesma rodada. Somar o que saiu e
     * devolver o saldo negativo cobre todos esses casos sem o serviço precisar conhecer
     * as regras de nenhum jogo. Onde a soma já é zero ou positiva (a rodada pagou), não
     * há o que devolver.
     */
    const presas = await this.db.query<{ round_id: string; user_id: string; saldo: string }>(
      `SELECT l.round_id, l.user_id, SUM(l.amount)::text AS saldo
         FROM ledger_entries l
         JOIN rodadas r ON r.id = l.round_id
        WHERE r.fechada_em IS NULL
          AND r.aberta_em < now() - ($1 || ' minutes')::interval
        GROUP BY l.round_id, l.user_id
       HAVING SUM(l.amount) < 0`,
      [String(carenciaEmMinutos)],
    );

    const devolvidas: Array<{ rodadaId: string; userId: string; valor: number }> = [];
    for (const presa of presas) {
      const valor = -Number(presa.saldo);
      if (!Number.isSafeInteger(valor) || valor <= 0) continue;
      try {
        const entrada = await this.wallet.credit(
          presa.user_id,
          valor,
          'ajuste',
          'rodada-presa',
          `devolucao:${presa.round_id}`,
          presa.round_id,
        );
        /*
         * O EVENTO FICA NA RODADA pra o extrato se explicar sozinho. Quem for investigar
         * "por que recebi isto" acha a rodada, vê que ela nunca liquidou, e vê a
         * devolução — sem precisar de ninguém pra contar a história.
         */
        if (!entrada.repetida) {
          await this.rodadas.anotar(presa.round_id, {
            tipo: 'DEVOLVIDA',
            usuarioId: presa.user_id,
            dados: { valor, motivo: 'a rodada não liquidou' },
          });
          devolvidas.push({ rodadaId: presa.round_id, userId: presa.user_id, valor });
        }
      } catch (erro) {
        registro.erro('rodadas-presas', 'não deu pra devolver esta rodada', {
          rodadaId: presa.round_id,
          erro: (erro as Error).message,
        });
      }
    }

    /*
     * FECHAR VEM DEPOIS DE PAGAR, e nunca antes.
     *
     * Se o fechamento viesse primeiro e o crédito falhasse, a rodada sairia da lista das
     * abertas carregando o débito — invisível e perdida. Nesta ordem, o pior caso é uma
     * rodada que aparece de novo na próxima subida, e a devolução idempotente não paga
     * duas vezes.
     */
    const aFechar = await this.db.query<{ id: string }>(
      `SELECT r.id FROM rodadas r
        WHERE r.fechada_em IS NULL
          AND r.aberta_em < now() - ($1 || ' minutes')::interval
          AND NOT EXISTS (
            SELECT 1 FROM ledger_entries l
             WHERE l.round_id = r.id
             GROUP BY l.user_id
            HAVING SUM(l.amount) < 0
          )`,
      [String(carenciaEmMinutos)],
    );
    for (const rodada of aFechar) {
      await this.rodadas.mudarEstado(rodada.id, 'RODADA_FECHADA', { fechada: true });
    }

    return devolvidas;
  }
}
