import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import {
  calendarioPara,
  DIAS_DO_CALENDARIO,
  estadoDaSequencia,
  premioDoDia,
} from './calendario';

interface LinhaDaSequencia {
  last_claim_day: number;
  last_claim_on: Date;
  streak: number;
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
   * O calendário desta pessoa: os trinta dias, onde ela está e se pode coletar agora.
   *
   * Os valores são calculados sobre o SALDO ATUAL, então o calendário que ela vê é o
   * calendário que ela vai receber — e não uma tabela genérica que depois paga outra
   * coisa.
   */
  async calendarioDe(userId: string, agora = new Date()) {
    const linha = await this.db.queryOne<LinhaDaSequencia>(
      'SELECT last_claim_day, last_claim_on, streak FROM daily_rewards WHERE user_id = $1',
      [userId],
    );
    const saldo = await this.wallet.balanceOf(userId);
    const estado = estadoDaSequencia(
      linha ? new Date(linha.last_claim_on) : null,
      linha?.last_claim_day ?? 0,
      agora,
    );

    return {
      dias: calendarioPara(saldo),
      diaAtual: estado.diaAtual,
      podeColetar: estado.podeColetar,
      /* Instante absoluto, não contagem: a tela conta sozinha e continua certa. */
      proximaAbertura: estado.proximaAbertura.toISOString(),
      sequenciaPerdida: estado.sequenciaPerdida,
      diasSeguidos: estado.podeColetar && estado.sequenciaPerdida ? 0 : linha?.streak ?? 0,
      premioDeHoje: premioDoDia(estado.diaAtual, saldo),
      totalDeDias: DIAS_DO_CALENDARIO,
    };
  }

  /**
   * Coleta o prêmio de hoje.
   *
   * A PROTEÇÃO CONTRA COLETAR DUAS VEZES ESTÁ NO BANCO, e não numa checagem antes do
   * pagamento. Dois toques rápidos no botão chegam como dois pedidos que rodam ao mesmo
   * tempo; um `if (jaColetou) return` entre eles deixa os dois passarem, porque nenhum
   * dos dois viu o outro gravar. Aqui a gravação é um `INSERT ... ON CONFLICT DO UPDATE`
   * com a condição `last_claim_on < CURRENT_DATE` na cláusula WHERE: os dois pedidos
   * disputam a MESMA linha, o banco serializa, e o segundo não encontra mais a condição
   * — não atualiza nada, não devolve nada, e não paga.
   *
   * O prêmio só é creditado depois que a gravação disse que foi ela quem marcou o dia.
   */
  async coletar(userId: string, agora = new Date()) {
    const linha = await this.db.queryOne<LinhaDaSequencia>(
      'SELECT last_claim_day, last_claim_on, streak FROM daily_rewards WHERE user_id = $1',
      [userId],
    );
    const estado = estadoDaSequencia(
      linha ? new Date(linha.last_claim_on) : null,
      linha?.last_claim_day ?? 0,
      agora,
    );

    if (!estado.podeColetar) {
      throw new BadRequestException(
        `Você já coletou hoje. O dia ${estado.diaAtual >= DIAS_DO_CALENDARIO ? 1 : estado.diaAtual + 1} abre à meia-noite.`,
      );
    }

    const seguidos = estado.sequenciaPerdida || !linha ? 1 : linha.streak + 1;

    const marcado = await this.db.queryOne<{ last_claim_day: number; streak: number }>(
      `INSERT INTO daily_rewards (user_id, last_claim_day, last_claim_on, streak)
       VALUES ($1, $2, CURRENT_DATE, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET last_claim_day = EXCLUDED.last_claim_day,
             last_claim_on  = EXCLUDED.last_claim_on,
             streak         = EXCLUDED.streak
         WHERE daily_rewards.last_claim_on < CURRENT_DATE
       RETURNING last_claim_day, streak`,
      [userId, estado.diaAtual, seguidos],
    );

    if (!marcado) {
      // A outra chamada chegou primeiro. Ela pagou; esta não paga de novo.
      throw new BadRequestException('Você já coletou hoje.');
    }

    const saldo = await this.wallet.balanceOf(userId);
    const premio = premioDoDia(estado.diaAtual, saldo);
    await this.wallet.credit(userId, premio, 'presente', ORIGEM);

    return {
      dia: estado.diaAtual,
      premio,
      diasSeguidos: marcado.streak,
      novoSaldo: await this.wallet.balanceOf(userId),
      calendario: await this.calendarioDe(userId, agora),
    };
  }
}
