import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { playRound as playBaccaratRound, resolveBet } from './baccarat.engine';
import { BaccaratBetType, RANKS, Rank } from './baccarat.config';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';
import { CartaComNaipe, nomeDaCarta } from '../shared/naipes';
import { Sapata } from '../shared/sapata';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
import { NIVEIS_DE_MESA, problemaComAAposta } from '../shared/niveis-de-mesa';

const VALID_BET_TYPES: BaccaratBetType[] = ['jogador', 'banca', 'empate'];
/** 24 colunas de 6 no painel — 144 rodadas enchem a tela inteira. */
const HISTORY_LIMIT = 144;

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'bacara';

@Injectable()
export class BaccaratService {
  private readonly history: RoundRecord[] = [];
  /**
   * Uma sapata só pra mesa inteira. No bacará todo mundo na mesa joga das mesmas cartas
   * — é o que faz o placar (as "estradas") ter sentido: ele conta a história de UMA
   * sapata, não de sapatas diferentes por jogador.
   */
  private readonly sapata = new Sapata<Rank>(RANKS);

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
    private readonly roadmapService: RoadmapService,
    private readonly acoes: AcoesRepetidas,
  ) {}

  getConfig() {
    return { minBet: NIVEIS_DE_MESA[0].minimo, maxBet: NIVEIS_DE_MESA[0].maximo };
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
  async playRound(userId: string, betType: BaccaratBetType, amount: number, actionId?: string) {
    const problema = problemaComAAposta(amount, await this.walletService.balanceOf(userId));
    if (problema) throw new BadRequestException(problema);
    if (!VALID_BET_TYPES.includes(betType)) {
      throw new BadRequestException('Tipo de aposta inválido — use jogador, banca ou empate.');
    }

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, amount, 'aposta', GAME_ID, actionId);

      // Embaralhar acontece ENTRE rodadas, nunca no meio de uma.
      const embaralhou = this.sapata.embaralharSePassouDoCorte();

      /*
       * As cartas saem da sapata JÁ com naipe — o naipe agora é o da carta que saiu de
       * verdade, não um sorteado à parte pra tela ter o que desenhar. `sorteadas` guarda
       * a ordem de saída, que é o que permite devolver cada carta pro lado certo depois.
       */
      const sorteadas: CartaComNaipe<Rank>[] = [];
      const round = playBaccaratRound(() => {
        const carta = this.sapata.comprar();
        sorteadas.push(carta);
        return carta.rank;
      });
      const totalReturn = resolveBet(betType, round.winner, amount);

      if (totalReturn > 0) {
        await this.walletService.credit(userId, totalReturn, 'premio', GAME_ID);
      }
      await this.tournaments.recordRound(userId, GAME_ID, amount, totalReturn);

      this.history.push({ outcome: round.winner });
      if (this.history.length > HISTORY_LIMIT) this.history.shift();

      /*
       * A ordem de saída do bacará é fixa: jogador, banca, jogador, banca, e só então as
       * terceiras cartas — primeiro a do jogador, depois a da banca. Por isso dá pra
       * devolver cada carta pro seu lado sem adivinhação.
       */
      const doJogador = [sorteadas[0], sorteadas[2]];
      const daBanca = [sorteadas[1], sorteadas[3]];
      let proxima = 4;
      if (round.playerCards.length === 3) doJogador.push(sorteadas[proxima++]);
      if (round.bankerCards.length === 3) daBanca.push(sorteadas[proxima++]);

      // Rede de segurança: se a ordem acima não bater com o que o motor jogou, a tela
      // mostraria uma carta que não saiu. Melhor estourar aqui do que mentir na mesa.
      const bate = (cartas: CartaComNaipe<Rank>[], valores: Rank[]) =>
        cartas.length === valores.length && cartas.every((c, i) => c.rank === valores[i]);
      if (!bate(doJogador, round.playerCards) || !bate(daBanca, round.bankerCards)) {
        throw new Error('As cartas da sapata não bateram com a rodada do motor.');
      }

      return {
        ...round,
        playerCards: doJogador.map(nomeDaCarta),
        bankerCards: daBanca.map(nomeDaCarta),
        betType,
        amount,
        totalReturn,
        embaralhouAgora: embaralhou,
        cartasAteOCorte: this.sapata.cartasAteOCorte,
        newBalance: await this.walletService.balanceOf(userId),
        roadmap: this.getRoadmap(),
      };
    });
  }
}

