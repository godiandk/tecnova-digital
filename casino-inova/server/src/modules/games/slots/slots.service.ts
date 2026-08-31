import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { spin, theoreticalRtp } from './slots.engine';
import { MAX_BET, MIN_BET, MIN_MATCH, PAYLINES, REELS, ROWS, SLOT_SYMBOLS } from './slots.config';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'slots';

@Injectable()
export class SlotsService {
  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  getConfig() {
    return {
      symbols: SLOT_SYMBOLS,
      /** Formato da grade e linhas vão junto: a tela desenha a partir daqui, sem cópia própria. */
      reels: REELS,
      rows: ROWS,
      paylines: PAYLINES,
      minMatch: MIN_MATCH,
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
  async playSpin(userId: string, bet: number, actionId?: string) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, bet, 'aposta', GAME_ID, actionId);
      const result = spin(bet);

      if (result.totalWin > 0) {
        await this.walletService.credit(userId, result.totalWin, 'premio', GAME_ID);
      }
      await this.tournaments.recordRound(userId, GAME_ID, bet, result.totalWin);

      return { ...result, bet, newBalance: await this.walletService.balanceOf(userId) };
    });
  }
}
