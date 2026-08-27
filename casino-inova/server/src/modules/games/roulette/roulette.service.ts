import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { spin, theoreticalRtp } from './roulette.engine';
import { colorOf, MAX_BET, MIN_BET, RED_NUMBERS, RouletteBet, TOTAL_MULTIPLIER } from './roulette.config';

/** Quantos números o painel da mesa guarda — mesa real costuma mostrar os últimos ~20. */
const HISTORY_LIMIT = 40;

@Injectable()
export class RouletteService {
  private readonly history: number[] = [];

  constructor(private readonly walletService: WalletService) {}

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

    this.history.push(result.pocket);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    return { ...result, amount, newBalance: this.walletService.balanceOf(userId), history: this.getHistory() };
  }
}
