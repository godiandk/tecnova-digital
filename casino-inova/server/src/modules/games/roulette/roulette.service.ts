import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { ApostaComValor, resolverApostas, spinWheel, theoreticalRtp } from './roulette.engine';
import {
  colorOf,
  MAXIMO_DE_APOSTAS_POR_RODADA,
  RED_NUMBERS,
  TOTAL_MULTIPLIER,
} from './roulette.config';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
import { NIVEIS_DE_MESA, problemaComAAposta } from '../shared/niveis-de-mesa';

/** Quantos números o painel da mesa guarda — mesa real costuma mostrar os últimos ~20. */
const HISTORY_LIMIT = 40;

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'roleta';

@Injectable()
export class RouletteService {
  private readonly history: number[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  /**
   * Placar da roleta. Diferente do bacará, mesa de roleta NÃO usa as cinco estradas:
   * ela mostra a lista dos últimos números sorteados com a cor de cada um, mais os
   * contadores de vermelho/preto, par/ímpar e alto/baixo. Por isso aqui é um formato
   * próprio, em vez de reusar o RoadmapService.
   *
   * Como em todo placar deste projeto: isso é histórico, não previsão. A roda não tem
   * memória — sair 10 vermelhos seguidos não muda em nada a chance do próximo giro.
   */
  getHistory() {
    const numbers = this.history.map((pocket) => ({ pocket, color: colorOf(pocket) }));
    const decided = this.history.filter((pocket) => pocket !== 0);

    return {
      numbers,
      totals: {
        vermelho: this.history.filter((pocket) => colorOf(pocket) === 'vermelho').length,
        preto: this.history.filter((pocket) => colorOf(pocket) === 'preto').length,
        zero: this.history.filter((pocket) => pocket === 0).length,
        par: decided.filter((pocket) => pocket % 2 === 0).length,
        impar: decided.filter((pocket) => pocket % 2 === 1).length,
        baixo: decided.filter((pocket) => pocket <= 18).length,
        alto: decided.filter((pocket) => pocket >= 19).length,
        total: this.history.length,
      },
    };
  }

  getConfig() {
    return {
      /*
       * O mínimo do degrau de entrada, e SÓ o mínimo: não existe mais aposta máxima
       * (ver `problemaComAAposta`). O campo `maxBet` saiu daqui porque a tela o usava
       * como teto de um − / + — e com noventa e nove bilhões no bolso, aquele teto de
       * mil obrigava a pessoa a apertar o "mais" para sempre.
       */
      minBet: NIVEIS_DE_MESA[0].minimo,
      redNumbers: Array.from(RED_NUMBERS),
      totalMultiplier: TOTAL_MULTIPLIER,
      theoreticalRtp: theoreticalRtp(),
      maximoDeApostas: MAXIMO_DE_APOSTAS_POR_RODADA,
    };
  }

  /**
   * Uma rodada de roleta: várias apostas, uma bola.
   *
   * A regra de valor é aplicada A CADA APOSTA, e não à soma. É o mesmo que a mesa faz:
   * o mínimo é por casa — cinquenta no 17 e cinquenta no vermelho são duas apostas
   * válidas de cinquenta, não uma de cem. Mas o SALDO é conferido sobre a soma, porque
   * o que sai do bolso é a soma; conferir aposta por aposta deixaria passar dez apostas
   * de mil com mil no bolso.
   */
  async playSpin(userId: string, apostas: ApostaComValor[], actionId?: string) {
    if (!Array.isArray(apostas) || apostas.length === 0) {
      throw new BadRequestException('Encoste pelo menos uma ficha na mesa.');
    }
    if (apostas.length > MAXIMO_DE_APOSTAS_POR_RODADA) {
      throw new BadRequestException(`No máximo ${MAXIMO_DE_APOSTAS_POR_RODADA} apostas por rodada.`);
    }

    const saldo = await this.walletService.balanceOf(userId);
    let total = 0;
    for (const aposta of apostas) {
      if (!TOTAL_MULTIPLIER[aposta.type]) throw new BadRequestException('Tipo de aposta inválido.');
      if (
        aposta.type === 'numero' &&
        (!Number.isInteger(aposta.number) || aposta.number! < 0 || aposta.number! > 36)
      ) {
        throw new BadRequestException('Aposta em número exato precisa de um número entre 0 e 36.');
      }
      const problema = problemaComAAposta(aposta.amount, saldo);
      if (problema) throw new BadRequestException(problema);
      total += aposta.amount;
    }
    if (total > saldo) {
      throw new BadRequestException(
        `Você tem ${saldo.toLocaleString('pt-BR')} fichas — a soma das apostas não pode passar disso.`,
      );
    }

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, total, 'aposta', GAME_ID, actionId);

      const pocket = spinWheel();
      const results = resolverApostas(pocket, apostas);
      const totalReturn = results.reduce((soma, r) => soma + r.totalReturn, 0);

      if (totalReturn > 0) {
        await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
      }
      await this.tournaments.recordRound(userId, GAME_ID, total, totalReturn);

      this.history.push(pocket);
      if (this.history.length > HISTORY_LIMIT) this.history.shift();

      return {
        pocket,
        color: colorOf(pocket),
        results,
        win: totalReturn > 0,
        totalStake: total,
        totalReturn,
        newBalance: await this.walletService.balanceOf(userId),
        history: this.getHistory(),
      };
    });
  }
}
