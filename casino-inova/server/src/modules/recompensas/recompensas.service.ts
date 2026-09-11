import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { diaDoServidor } from '../../comum/dia-do-servidor';
import {
  bonusDeNivel,
  calendarioPara,
  casasDaGrade,
  estadoDaSequencia,
  hojeNoMes,
  multiplicadorDoDia,
  premioDoDia,
} from './calendario';

interface LinhaDaSequencia {
  last_claim_day: number;
  last_claim_on: string | Date;
  streak: number;
  streak_total: number;
}

/** A origem que aparece no extrato. É por ela que dá pra auditar tudo que foi dado. */
const ORIGEM = 'recompensa-diaria';

@Injectable()
export class RecompensasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * O calendário desta pessoa: as casas do mês, onde ela está e se pode coletar agora.
   *
   * Os valores saem do NÍVEL dela, então o calendário que ela vê é o calendário que ela
   * vai receber — e não uma tabela genérica que depois paga outra coisa.
   */
  async calendarioDe(userId: string, hoje = diaDoServidor()) {
    const [linha, nivel] = await Promise.all([this.sequenciaDe(userId), this.nivelDe(userId)]);
    const estado = estadoDaSequencia(
      linha ? normalizarDia(linha.last_claim_on) : null,
      linha?.last_claim_day ?? 0,
      hoje,
    );
    const casas = casasDaGrade(hoje);

    return {
      dias: calendarioPara(nivel, hoje),
      diaAtual: estado.diaAtual,
      podeColetar: estado.podeColetar,
      /* Data absoluta, não contagem: a tela conta sozinha e continua certa. */
      proximaAbertura: estado.proximaAbertura,
      sequenciaPerdida: estado.sequenciaPerdida,
      /*
       * DOIS NÚMEROS DIFERENTES, e a tela mostra os dois. `diaAtual` é a casa da grade
       * deste mês; `diasSeguidos` é a sequência de verdade, que atravessa a virada do mês.
       * Quem fechou uma grade de 31 volta pra casa 1 com a sequência intacta.
       */
      diasSeguidos: estado.sequenciaPerdida ? 0 : linha?.streak_total ?? 0,
      premioDeHoje: premioDoDia(estado.diaAtual, nivel, casas),
      totalDeDias: casas,
      /* Que dia do mês é hoje, pra a tela destacar a casa certa da grade. */
      diaDoMes: hojeNoMes(hoje),
      nivel,
      bonusDeNivel: bonusDeNivel(nivel),
      /* O dia do servidor, em UTC, pra a tela poder explicar quando o dia vira. */
      hoje,
    };
  }

  /**
   * Coleta o prêmio de hoje.
   *
   * A COLETA INTEIRA É UMA TRANSAÇÃO SÓ, e é essa a correção que importa. Antes a linha
   * era marcada como coletada ANTES de o prêmio ser creditado, fora de transação: morrendo
   * o processo entre as duas, a pessoa ficava marcada como tendo coletado E NÃO RECEBIA —
   * e não podia coletar de novo. Dinheiro não movido com a marca já gravada é invisível:
   * ninguém reclama do que não sabe que existia. Agora ou as três gravações acontecem
   * (histórico, carteira, sequência), ou nenhuma acontece.
   *
   * A TRAVA CONTRA COLETAR DUAS VEZES ESTÁ NO BANCO, e não numa checagem antes do
   * pagamento. Dois toques rápidos chegam como dois pedidos que rodam ao mesmo tempo; um
   * `if (jaColetou) return` entre eles deixa os dois passarem, porque nenhum dos dois viu
   * o outro gravar. Aqui quem recusa é o índice único `(user_id, claimed_on)`: o segundo
   * INSERT viola, a transação inteira é desfeita, e não paga.
   *
   * @param claimId a chave que o cliente escolhe pra identificar ESTA coleta. Dois toques,
   *   um retry depois de timeout, ou o mesmo pedido saindo de dois aparelhos chegam com a
   *   mesma chave — e a segunda devolve o resultado da primeira em vez de um erro, porque
   *   do ponto de vista de quem tocou o botão a coleta deu certo. Sem `claimId`, um id é
   *   sorteado aqui e a proteção fica sendo só a do dia.
   */
  async coletar(userId: string, hoje = diaDoServidor(), claimId?: string) {
    const pedido = claimId?.trim() || randomUUID();
    if (pedido.length > 200) throw new BadRequestException('claimId longo demais.');

    /*
     * A CHAVE GUARDADA CARREGA O DIA, e isso fecha um caso estreito mas real.
     *
     * `claim_id` é chave primária. Um cliente que reusasse a MESMA chave dois dias
     * seguidos (um valor fixo escrito no código dele, por exemplo) bateria na primária no
     * segundo dia — e como o `ON CONFLICT` do INSERT cobre `(user_id, claimed_on)` e não a
     * primária, o conflito viraria exceção e derrubaria a transação inteira. A pessoa
     * receberia um erro no lugar do prêmio, e nunca mais coletaria com aquela chave.
     *
     * Compondo com o dia, a mesma chave em dias diferentes vira dois identificadores
     * diferentes: o retry de hoje continua sendo o mesmo pedido, e o de amanhã é outro —
     * que é exatamente o que "esta coleta" quer dizer.
     */
    const id = `${hoje}|${pedido}`;

    /*
     * O MESMO claimId JÁ COLETADO DEVOLVE O MESMO RESULTADO. É o que separa idempotência
     * de "erro repetido": quem apertou o botão duas vezes tem que ver o prêmio, não um
     * aviso de que já coletou.
     */
    const jaFeita = await this.db.queryOne<LinhaDeColeta>(
      'SELECT * FROM daily_reward_claims WHERE claim_id = $1 AND user_id = $2',
      [id, userId],
    );
    if (jaFeita) return this.respostaDaColeta(userId, jaFeita, hoje, true);

    const [linha, nivel] = await Promise.all([this.sequenciaDe(userId), this.nivelDe(userId)]);
    const estado = estadoDaSequencia(
      linha ? normalizarDia(linha.last_claim_on) : null,
      linha?.last_claim_day ?? 0,
      hoje,
    );

    if (!estado.podeColetar) {
      throw new BadRequestException(`Você já coletou hoje. O próximo dia abre em ${estado.proximaAbertura}.`);
    }

    const casas = casasDaGrade(hoje);
    const seguidos = estado.sequenciaPerdida || !linha ? 1 : (linha.streak_total ?? 0) + 1;
    const multiplicador = multiplicadorDoDia(estado.diaAtual, casas);
    const bonus = bonusDeNivel(nivel);
    const premio = premioDoDia(estado.diaAtual, nivel, casas);

    const coleta = await this.db.transaction(async (client) => {
      /*
       * O HISTÓRICO VEM PRIMEIRO, e a ordem é a mesma que o P0.2 fixou pras rodadas:
       * registrar antes de mexer no dinheiro. Aqui isso também é a trava — se outro pedido
       * já gravou o dia de hoje, este INSERT estoura e nada mais acontece.
       */
      const { rows } = await client.query<LinhaDeColeta>(
        `INSERT INTO daily_reward_claims
           (claim_id, user_id, claimed_on, calendar_day, streak, level, day_multiplier, level_bonus_cents, chips)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, claimed_on) DO NOTHING
         RETURNING *`,
        [id, userId, hoje, estado.diaAtual, seguidos, nivel, multiplicador, Math.round(bonus * 100), premio],
      );
      if (rows.length === 0) return null; // outro pedido chegou primeiro: ele pagou.

      await this.wallet.creditInTransaction(client, userId, premio, 'presente', ORIGEM);

      await client.query(
        `INSERT INTO daily_rewards (user_id, last_claim_day, last_claim_on, streak, streak_total)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO UPDATE
           SET last_claim_day = EXCLUDED.last_claim_day,
               last_claim_on  = EXCLUDED.last_claim_on,
               streak         = EXCLUDED.streak,
               streak_total   = EXCLUDED.streak_total`,
        [userId, estado.diaAtual, hoje, seguidos, seguidos],
      );
      return rows[0];
    });

    if (!coleta) throw new BadRequestException('Você já coletou hoje.');
    return this.respostaDaColeta(userId, coleta, hoje, false);
  }

  /**
   * As últimas coletas desta pessoa, com o que foi usado na conta de cada uma.
   *
   * Guardar nível, multiplicador e bônus junto é o que permite responder "por que recebi
   * 3.000?" seis meses depois. Recalcular com os números de hoje responderia outra
   * pergunta — e daria outra resposta, toda vez que a configuração mudasse.
   */
  async historicoDe(userId: string, limite = 60) {
    const linhas = await this.db.query<LinhaDeColeta>(
      `SELECT * FROM daily_reward_claims WHERE user_id = $1 ORDER BY claimed_on DESC LIMIT $2`,
      [userId, Math.max(1, Math.min(365, Math.floor(limite)))],
    );
    return linhas.map((l) => ({
      claimId: l.claim_id,
      dia: normalizarDia(l.claimed_on),
      casaDoCalendario: l.calendar_day,
      diasSeguidos: l.streak,
      nivel: l.level,
      multiplicadorDoDia: l.day_multiplier,
      bonusDeNivel: l.level_bonus_cents / 100,
      premio: Number(l.chips),
    }));
  }

  private async respostaDaColeta(userId: string, coleta: LinhaDeColeta, hoje: string, repetida: boolean) {
    return {
      dia: coleta.calendar_day,
      premio: Number(coleta.chips),
      diasSeguidos: coleta.streak,
      nivel: coleta.level,
      bonusDeNivel: coleta.level_bonus_cents / 100,
      claimId: coleta.claim_id,
      /* A tela precisa saber que isto foi a MESMA coleta, e não uma nova. */
      repetida,
      novoSaldo: await this.wallet.balanceOf(userId),
      calendario: await this.calendarioDe(userId, hoje),
    };
  }

  private sequenciaDe(userId: string) {
    return this.db.queryOne<LinhaDaSequencia>(
      'SELECT last_claim_day, last_claim_on, streak, streak_total FROM daily_rewards WHERE user_id = $1',
      [userId],
    );
  }

  /**
   * O nível do jogador — a única coisa que o prêmio olha além do dia.
   *
   * Nível ausente vira 1: uma conta que sumiu entre a autenticação e a coleta recebe o
   * prêmio mais baixo, que é o lado seguro de errar.
   */
  private async nivelDe(userId: string): Promise<number> {
    const linha = await this.db.queryOne<{ level: number }>('SELECT level FROM users WHERE id = $1', [userId]);
    return linha?.level ?? 1;
  }
}

interface LinhaDeColeta {
  claim_id: string;
  user_id: string;
  claimed_on: string | Date;
  calendar_day: number;
  streak: number;
  level: number;
  day_multiplier: number;
  level_bonus_cents: number;
  chips: string | number;
}

/**
 * A coluna `DATE` volta do driver como `Date` ou como texto, conforme a configuração do
 * `pg`. Os dois viram `AAAA-MM-DD` aqui, e nenhum passa por fuso local no caminho — um
 * `Date` reinterpretado no fuso da máquina perde um dia em metade do planeta.
 */
function normalizarDia(valor: string | Date): string {
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
}
