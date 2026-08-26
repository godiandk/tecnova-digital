import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { spin, theoreticalRtp } from './roulette.engine';
import { MAX_BET, MIN_BET, RED_NUMBERS, RouletteBet, TOTAL_MULTIPLIER } from './roulette.config';

@Injectable()
export class RouletteService {
  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      redNumbers: Array.from(RED_NUMBERS),
      totalMultiplier: TOTAL_MULTIPLIER,
      theoreticalRtp: theoreticalRtp(),
    };
  }

  playSpin(userId: string, bet: RouletteBet, amount: number) {
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }
    if (!TOTAL_MULTIPLIER[bet.type]) {
      throw new BadRequestException('Tipo de aposta inválido.');
    }
    if (bet.type === 'numero' && (bet.number === undefined || bet.number < 0 || bet.number > 36)) {
      throw new BadRequestException('Aposta em número exato precisa de um número entre 0 e 36.');
    }

    this.walletService.debit(userId, amount, 'aposta');
    const result = spin(bet, amount);

    if (result.totalReturn > 0) {
      this.walletService.credit(userId, result.totalReturn, 'premio');
    }

    return { ...result, amount, newBalance: this.walletService.balanceOf(userId) };
  }
}
