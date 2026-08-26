import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { NumberBet, resolveBets, rollDice, theoreticalRtp } from './banca-francesa.engine';
import { MAX_BET, MAX_SIMULTANEOUS_NUMBERS, MIN_BET, TOTAL_MULTIPLIER_BY_MATCHES } from './banca-francesa.config';

@Injectable()
export class BancaFrancesaService {
  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      maxSimultaneousNumbers: MAX_SIMULTANEOUS_NUMBERS,
      totalMultiplierByMatches: TOTAL_MULTIPLIER_BY_MATCHES,
      theoreticalRtp: theoreticalRtp(),
    };
  }

  playRound(userId: string, bets: NumberBet[]) {
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > MAX_SIMULTANEOUS_NUMBERS) {
      throw new BadRequestException(`Aposte em 1 a ${MAX_SIMULTANEOUS_NUMBERS} números.`);
    }

    const seenNumbers = new Set<number>();
    for (const bet of bets) {
      if (!Number.isInteger(bet.number) || bet.number < 1 || bet.number > 6) {
        throw new BadRequestException('Cada número apostado precisa estar entre 1 e 6.');
      }
      if (seenNumbers.has(bet.number)) {
        throw new BadRequestException(`Número ${bet.number} apostado mais de uma vez — some tudo numa aposta só.`);
      }
      seenNumbers.add(bet.number);
      if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
        throw new BadRequestException(`Cada aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
      }
    }

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    this.walletService.debit(userId, totalStake, 'aposta');

    const dice = rollDice();
    const results = resolveBets(dice, bets);
    const totalReturn = results.reduce((sum, result) => sum + result.totalReturn, 0);

    if (totalReturn > 0) {
      this.walletService.credit(userId, totalReturn, 'premio');
    }

    return { dice, results, totalStake, totalReturn, newBalance: this.walletService.balanceOf(userId) };
  }
}
