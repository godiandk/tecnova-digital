import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { playRound as playBaccaratRound, resolveBet } from './baccarat.engine';
import { BaccaratBetType, MAX_BET, MIN_BET, Rank } from './baccarat.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';
import { CartaComNaipe, nomeDaCarta, vestirDeNaipe } from '../shared/naipes';

const VALID_BET_TYPES: BaccaratBetType[] = ['jogador', 'banca', 'empate'];
/** 24 colunas de 6 no painel — 144 rodadas enchem a tela inteira. */
const HISTORY_LIMIT = 144;

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'bacara';

@Injectable()
export class BaccaratService {
  private readonly history: RoundRecord[] = [];

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
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
  async playRound(userId: string, betType: BaccaratBetType, amount: number) {
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }
    if (!VALID_BET_TYPES.includes(betType)) {
      throw new BadRequestException('Tipo de aposta inválido — use jogador, banca ou empate.');
    }

    await this.walletService.debit(userId, amount, 'aposta', GAME_ID);
    const round = playBaccaratRound();
    const totalReturn = resolveBet(betType, round.winner, amount);

    if (totalReturn > 0) {
      await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
    }
    await this.tournaments.recordRound(userId, GAME_ID, amount, totalReturn);

    this.history.push({ outcome: round.winner });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();

    /*
     * As cartas saem do motor só com valor — o baralho é infinito e naipe não vale
     * nada no bacará. O naipe é sorteado aqui pra a tela poder desenhar a carta que
     * saiu, em vez de o app escolher uma parecida. Ver shared/naipes.ts.
     */
    const cartasNaMesa: CartaComNaipe<Rank>[] = [];
    const playerCards = vestirDeNaipe(round.playerCards, cartasNaMesa).map(guardarEnomear(cartasNaMesa));
    const bankerCards = vestirDeNaipe(round.bankerCards, cartasNaMesa).map(guardarEnomear(cartasNaMesa));

    return {
      ...round,
      playerCards,
      bankerCards,
      betType,
      amount,
      totalReturn,
      newBalance: await this.walletService.balanceOf(userId),
      roadmap: this.getRoadmap(),
    };
  }
}

/**
 * Anota a carta na mesa e devolve o nome da imagem dela.
 *
 * A anotação importa: é ela que faz o segundo lado enxergar o que o primeiro já usou, e
 * é o que impede a mesma carta de aparecer nos dois lados da mesma rodada.
 */
function guardarEnomear(mesa: CartaComNaipe<Rank>[]) {
  return (carta: CartaComNaipe<Rank>) => {
    mesa.push(carta);
    return nomeDaCarta(carta);
  };
}
