import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BacBoBet, resolveBets, roll, theoreticalRtp } from './bac-bo.engine';
import { MAIOR_MULTIPLICADOR, SIDE_TOTAL_MULTIPLIER, TIE_PROFIT_ODDS, TIE_REFUND_MULTIPLIER } from './bac-bo.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
import { MaquinaDeRodada } from '../core/maquina-de-rodada';
import { DegrauDoJogador } from '../shared/degrau-do-jogador.service';
import { FaixaDeAposta } from '../shared/faixa-de-aposta';
import { NIVEIS_DE_MESA, problemaComAAposta } from '../shared/niveis-de-mesa';

const BET_TYPES: BacBoBet['type'][] = ['jogador', 'banca', 'empate'];
/** Quantas rodadas o placar guarda — o painel mostra 24 colunas de 6, então 144 cobre a tela cheia. */
const HISTORY_LIMIT = 144;

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'bac-bo';

@Injectable()
export class BacBoService {
  private readonly history: RoundRecord[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly faixas: FaixaDeAposta,
    private readonly degraus: DegrauDoJogador,
    private readonly tournaments: TournamentsService,
    private readonly roadmapService: RoadmapService,
    private readonly acoes: AcoesRepetidas,
    private readonly maquina: MaquinaDeRodada,
  ) {}

  /** As cinco estradas do placar, calculadas a partir do histórico da mesa. */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

    /*
   * A CONFIGURAÇÃO PASSOU A DEPENDER DE QUEM PERGUNTA.
   *
   * Ela publicava `NIVEIS_DE_MESA[0].minimo` — o mínimo do BRONZE — pra todo mundo. Na
   * tela de quem tem bilhões isso virava "o mínimo é 500.000.000" ao lado de um trilho
   * oferecendo fichas de 50: nenhuma combinação de fichas alcançava o mínimo, e a mesa
   * ficava matematicamente inutilizável.
   *
   * Agora a faixa vem de `FaixaDeAposta`, que é a fonte única — ver o arquivo dela.
   */
  async getConfig(userId: string) {
    const faixa = await this.faixas.de(userId, 3, MAIOR_MULTIPLICADOR);
    return {
      ...faixa,
      minBet: faixa.minBet,
      maxBet: faixa.maxBet,
      betTypes: BET_TYPES,
      sideTotalMultiplier: SIDE_TOTAL_MULTIPLIER,
      tieRefundMultiplier: TIE_REFUND_MULTIPLIER,
      tieProfitOdds: TIE_PROFIT_ODDS,
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((type) => [type, theoreticalRtp(type)])),
    };
  }

  /** Recebe o saldo porque o limite da aposta sai do NÍVEL de quem aposta, não de um número fixo. */
  validateBets(bets: BacBoBet[], saldo: number, nivelDoJogador: number) {
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > BET_TYPES.length) {
      throw new BadRequestException(`Aposte em 1 a ${BET_TYPES.length} tipos (jogador, banca, empate).`);
    }
    const seen = new Set<string>();
    for (const bet of bets) {
      if (!BET_TYPES.includes(bet.type)) {
        throw new BadRequestException(`Tipo de aposta inválido: ${bet.type}.`);
      }
      if (seen.has(bet.type)) {
        throw new BadRequestException(`Aposta em "${bet.type}" duplicada — some tudo numa aposta só.`);
      }
      seen.add(bet.type);
      const problema = problemaComAAposta(bet.amount, saldo, nivelDoJogador, MAIOR_MULTIPLICADOR);
      if (problema) throw new BadRequestException(problema);
    }
  }

  async playRound(userId: string, bets: BacBoBet[], actionId?: string) {
    /*
     * Quem é esta pessoa economicamente: saldo, nível e o degrau que os dois liberam.
     * O degrau é `min(o que o saldo banca, o que o nível liberou)` — comprar fichas dá
     * mais rodadas na mesa dela, não passagem pra mesa de cima.
     */
    const quem = await this.degraus.de(userId);
    this.validateBets(bets, quem.saldo, quem.nivel);

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      /*
       * A RODADA É REGISTRADA ANTES DE O DINHEIRO SE MEXER. Ver MaquinaDeRodada: se o
       * processo morrer entre o débito e o registro, sobra dinheiro movido sem nada que
       * o explique.
       */
      const rodada = await this.maquina.comecar({ jogo: GAME_ID, usuarioId: userId, apostas: bets.map((b) => ({ casa: b.type, valor: b.amount })) });
      await this.walletService.debit(userId, totalStake, 'aposta', GAME_ID, actionId, rodada.id);

      const result = roll();
      const results = resolveBets(result, bets);
      const totalReturn = results.reduce((sum, item) => sum + item.totalReturn, 0);

      if (totalReturn > 0) {
        await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID, undefined, rodada.id);
      }
      await this.tournaments.recordRound(userId, GAME_ID, totalStake, totalReturn, quem.saldo);
      await rodada.terminar({
        resultado: { resultado: result.outcome, jogador: result.playerTotal, banca: result.bankerTotal },
        apostado: totalStake,
        retorno: totalReturn,
        detalhe: { porCasa: results.map((r) => ({ casa: r.type, valor: r.amount, retorno: r.totalReturn })) },
      });

      this.history.push({ outcome: result.outcome });
      if (this.history.length > HISTORY_LIMIT) this.history.shift();

      return {
        ...result,
        results,
        totalStake,
        totalReturn,
        newBalance: await this.walletService.balanceOf(userId),
        roadmap: this.getRoadmap(),
      };
    });
  }
}
