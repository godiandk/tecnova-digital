import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { playRound as playBaccaratRound, resolveBet } from './baccarat.engine';
import { BaccaratBetType, MAX_BET, MIN_BET } from './baccarat.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';

const VALID_BET_TYPES: BaccaratBetType[] = ['jogador', 'banca', 'empate'];
/** 24 colunas de 6 no painel — 144 rodadas enchem a tela inteira. */
const HISTORY_LIMIT = 144;

@Injectable()
export class BaccaratService {
  private readonly history: RoundRecord[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly roadmapService: RoadmapService,
  ) {}

  getConfig() {
    return { minBet: MIN_BET, maxBet: MAX_BET };
  }

  /**
   * As cinco estradas do placar. O bacará é o jogo pra que elas foram inventadas —
   * banca/jogador/empate mapeia direto, sem adaptação.
   */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

  /**
   * Bacará não tem decisão de jogador durante a rodada — a rodada inteira (2ª e
   * eventual 3ª carta de cada lado, comparação, prêmio) acontece numa chamada só,
   * igual a slots e roleta, diferente do blackjack.
   */
  playRound(userId: string, betType: BaccaratBetType, amount: number) {
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }
    if (!VALID_BET_TYPES.includes(betType)) {
      throw new BadRequestException('Tipo de aposta inválido — use jogador, banca ou empate.');
    }

    this.walletService.debit(userId, amount, 'aposta');
    const round = playBaccaratRound();
    const totalReturn = resolveBet(betType, round.winner, amount);

    if (totalReturn > 0) {
      this.walletService.credit(userId, totalReturn, 'premio');
    }

    this.history.push({ outcome: round.winner });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    return {
      ...round,
      betType,
      amount,
      totalReturn,
      newBalance: this.walletService.balanceOf(userId),
      roadmap: this.getRoadmap(),
    };
  }
}
