import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { resolveBet, runRound, StockBet, theoreticalRtp } from './stock-market.engine';
import { COMMISSION, MAX_BET, MAX_CHANGE_PERCENT, MIN_BET, StockDirection, TICKS_PER_ROUND } from './stock-market.config';

const DIRECTIONS: StockDirection[] = ['alta', 'baixa'];

@Injectable()
export class StockMarketService {
  /** Histórico recente de fechamentos, pro gráfico de rodadas anteriores na tela. */
  private readonly recentCloses: number[] = [];

  constructor(private readonly walletService: WalletService) {}

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

  playRound(userId: string, bet: StockBet) {
    if (!DIRECTIONS.includes(bet?.direction)) {
      throw new BadRequestException('Aposte em "alta" ou "baixa".');
    }
    if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    this.walletService.debit(userId, bet.amount, 'aposta');

    const round = runRound();
    const result = resolveBet(round, bet);

    if (result.totalReturn > 0) {
      this.walletService.credit(userId, result.totalReturn, 'premio');
    }

    this.recentCloses.push(round.closePercent);
    if (this.recentCloses.length > 30) this.recentCloses.shift();

    // `result` já carrega o closePercent — só o caminho do gráfico é adicionado aqui.
    return {
      path: round.path,
      ...result,
      newBalance: this.walletService.balanceOf(userId),
    };
  }
}
