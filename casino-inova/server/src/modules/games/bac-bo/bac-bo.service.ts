import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BacBoBet, resolveBets, roll, theoreticalRtp } from './bac-bo.engine';
import { SIDE_TOTAL_MULTIPLIER, TIE_PROFIT_ODDS, TIE_REFUND_MULTIPLIER } from './bac-bo.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
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
    private readonly tournaments: TournamentsService,
    private readonly roadmapService: RoadmapService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  /** As cinco estradas do placar, calculadas a partir do histórico da mesa. */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

  getConfig() {
    return {
      minBet: NIVEIS_DE_MESA[0].minimo,
      maxBet: NIVEIS_DE_MESA[0].maximo,
      betTypes: BET_TYPES,
      sideTotalMultiplier: SIDE_TOTAL_MULTIPLIER,
      tieRefundMultiplier: TIE_REFUND_MULTIPLIER,
      tieProfitOdds: TIE_PROFIT_ODDS,
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((type) => [type, theoreticalRtp(type)])),
    };
  }

  /** Recebe o saldo porque o limite da aposta sai do NÍVEL de quem aposta, não de um número fixo. */
  validateBets(bets: BacBoBet[], saldo: number) {
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
      const problema = problemaComAAposta(bet.amount, saldo);
      if (problema) throw new BadRequestException(problema);
    }
  }

  async playRound(userId: string, bets: BacBoBet[], actionId?: string) {
    this.validateBets(bets, await this.walletService.balanceOf(userId));

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, totalStake, 'aposta', GAME_ID, actionId);

      const result = roll();
      const results = resolveBets(result, bets);
      const totalReturn = results.reduce((sum, item) => sum + item.totalReturn, 0);

      if (totalReturn > 0) {
        await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
      }
      await this.tournaments.recordRound(userId, GAME_ID, totalStake, totalReturn);

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
