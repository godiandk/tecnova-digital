import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { BancaFrancesaBet, resolveBets, rollUntilDecisive, theoreticalRtp } from './banca-francesa.engine';
import { BET_TYPES, MAX_BET, MAX_SIMULTANEOUS_BETS, MIN_BET, TOTAL_RETURN_MULTIPLIER, WINNING_SUMS } from './banca-francesa.config';

@Injectable()
export class BancaFrancesaService {
  constructor(private readonly walletService: WalletService) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      maxSimultaneousBets: MAX_SIMULTANEOUS_BETS,
      betTypes: BET_TYPES,
      winningSums: WINNING_SUMS,
      totalReturnMultiplier: TOTAL_RETURN_MULTIPLIER,
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((type) => [type, theoreticalRtp(type)])),
    };
  }

  validateBets(bets: BancaFrancesaBet[]) {
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > MAX_SIMULTANEOUS_BETS) {
      throw new BadRequestException(`Aposte em 1 a ${MAX_SIMULTANEOUS_BETS} tipos (ases, pequeno, grande, linha).`);
    }
    const seenTypes = new Set<string>();
    for (const bet of bets) {
      if (!BET_TYPES.includes(bet.type)) {
        throw new BadRequestException(`Tipo de aposta inválido: ${bet.type}.`);
      }
      if (seenTypes.has(bet.type)) {
        throw new BadRequestException(`Aposta em "${bet.type}" duplicada — some tudo numa aposta só.`);
      }
      seenTypes.add(bet.type);
      if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
        throw new BadRequestException(`Cada aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
      }
    }
  }

  playRound(userId: string, bets: BancaFrancesaBet[]) {
    this.validateBets(bets);

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    this.walletService.debit(userId, totalStake, 'aposta');

    const { dice, sum, outcome, rerolls } = rollUntilDecisive();
    const results = resolveBets(outcome, bets);
    const totalReturn = results.reduce((total, result) => total + result.totalReturn, 0);

    if (totalReturn > 0) {
      this.walletService.credit(userId, totalReturn, 'premio');
    }

    return { dice, sum, outcome, rerolls, results, totalStake, totalReturn, newBalance: this.walletService.balanceOf(userId) };
  }
}
