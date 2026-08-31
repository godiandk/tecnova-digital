import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { resolveBet, runRound, StockBet, theoreticalRtp } from './stock-market.engine';
import { COMMISSION, MAX_BET, MAX_CHANGE_PERCENT, MIN_BET, StockDirection, TICKS_PER_ROUND } from './stock-market.config';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';

const DIRECTIONS: StockDirection[] = ['alta', 'baixa'];

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'stock-market';

@Injectable()
export class StockMarketService {
  /** Histórico recente de fechamentos, pro gráfico de rodadas anteriores na tela. */
  private readonly recentCloses: number[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      directions: DIRECTIONS,
      maxChangePercent: MAX_CHANGE_PERCENT,
      ticksPerRound: TICKS_PER_ROUND,
      commission: COMMISSION,
      theoreticalRtp: theoreticalRtp(),
    };
  }

  getHistory() {
    return { closes: [...this.recentCloses] };
  }

  async playRound(userId: string, bet: StockBet, actionId?: string) {
    if (!DIRECTIONS.includes(bet?.direction)) {
      throw new BadRequestException('Aposte em "alta" ou "baixa".');
    }
    if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, bet.amount, 'aposta', GAME_ID, actionId);

      const round = runRound();
      const result = resolveBet(round, bet);

      if (result.totalReturn > 0) {
        await this.walletService.credit(userId, result.totalReturn, 'premio', GAME_ID);
      }
      await this.tournaments.recordRound(userId, GAME_ID, bet.amount, result.totalReturn);

      this.recentCloses.push(round.closePercent);
      if (this.recentCloses.length > 30) this.recentCloses.shift();

      // `result` já carrega o closePercent — só o caminho do gráfico é adicionado aqui.
      return {
        path: round.path,
        ...result,
        newBalance: await this.walletService.balanceOf(userId),
      };
    });
  }
}
