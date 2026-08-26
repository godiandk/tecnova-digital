import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { spin, theoreticalRtp } from './slots.engine';
import { MAX_BET, MIN_BET, SLOT_SYMBOLS } from './slots.config';

@Injectable()
export class SlotsService {
  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return {
      symbols: SLOT_SYMBOLS,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      theoreticalRtp: theoreticalRtp(),
    };
  }

  /**
   * Debita a aposta antes de girar (se não tiver saldo, nem gira), gira, credita o
   * prêmio se houver, e devolve o resultado inteiro — cliente não decide nada disso,
   * só mostra o que o servidor sorteou.
   */
  playSpin(userId: string, bet: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    this.walletService.debit(userId, bet, 'aposta');
    const result = spin(bet);

    if (result.totalWin > 0) {
      this.walletService.credit(userId, result.totalWin, 'premio');
    }

    return { ...result, bet, newBalance: this.walletService.balanceOf(userId) };
  }
}
