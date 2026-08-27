import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BancaFrancesaBet, resolveBets, rollUntilDecisive, theoreticalRtp } from './banca-francesa.engine';
import { BET_TYPES, MAX_BET, MAX_SIMULTANEOUS_BETS, MIN_BET, TOTAL_RETURN_MULTIPLIER, WINNING_SUMS } from './banca-francesa.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';

const HISTORY_LIMIT = 144;

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'banca-francesa';

@Injectable()
export class BancaFrancesaService {
  private readonly history: RoundRecord[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly roadmapService: RoadmapService,
  ) {}

  /**
   * O placar reusa as mesmas cinco estradas do bacará. O mapeamento é natural: grande
   * e pequeno são os dois lados que se alternam (como banca e jogador), e ases é o
   * resultado raro que interrompe a sequência sem abrir coluna (como o empate).
   */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

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

  async playRound(userId: string, bets: BancaFrancesaBet[]) {
    this.validateBets(bets);

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);
    await this.walletService.debit(userId, totalStake, 'aposta', GAME_ID);

    const { dice, sum, outcome, rerolls } = rollUntilDecisive();
    const results = resolveBets(outcome, bets);
    const totalReturn = results.reduce((total, result) => total + result.totalReturn, 0);

    if (totalReturn > 0) {
      await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
    }
    await this.tournaments.recordRound(userId, GAME_ID, totalStake, totalReturn);

    this.history.push({
      outcome: outcome === 'grande' ? 'banca' : outcome === 'pequeno' ? 'jogador' : 'empate',
    });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    return {
      dice,
      sum,
      outcome,
      rerolls,
      results,
      totalStake,
      totalReturn,
      newBalance: await this.walletService.balanceOf(userId),
      roadmap: this.getRoadmap(),
    };
  }
}
