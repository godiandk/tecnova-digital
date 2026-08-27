import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BacBoBet, resolveBets, roll, theoreticalRtp } from './bac-bo.engine';
import { MAX_BET, MIN_BET, SIDE_TOTAL_MULTIPLIER, TIE_PROFIT_ODDS, TIE_REFUND_MULTIPLIER } from './bac-bo.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';

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
  ) {}

  /** As cinco estradas do placar, calculadas a partir do histórico da mesa. */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      betTypes: BET_TYPES,
      sideTotalMultiplier: SIDE_TOTAL_MULTIPLIER,
      tieRefundMultiplier: TIE_REFUND_MULTIPLIER,
      tieProfitOdds: TIE_PROFIT_ODDS,
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((type) => [type, theoreticalRtp(type)])),
    };
  }

  validateBets(bets: BacBoBet[]) {
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
      if (!Number.isFinite(bet.amount) || bet.amount < MIN_BET || bet.amount > MAX_BET) {
        throw new BadRequestException(`Cada aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
      }
    }
  }

  playRound(userId: string, bets: BacBoBet[]) {
    this.validateBets(bets);

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    this.walletService.debit(userId, totalStake, 'aposta', GAME_ID);

    const result = roll();
    const results = resolveBets(result, bets);
    const totalReturn = results.reduce((sum, item) => sum + item.totalReturn, 0);

    if (totalReturn > 0) {
      this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
    }
    this.tournaments.recordRound(userId, GAME_ID, totalStake, totalReturn);

    this.history.push({ outcome: result.outcome });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    return {
      ...result,
      results,
      totalStake,
      totalReturn,
      newBalance: this.walletService.balanceOf(userId),
      roadmap: this.getRoadmap(),
    };
  }
}
