import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BancaFrancesaBet, resolveBets, rollUntilDecisive, theoreticalRtp } from './banca-francesa.engine';
import {
  apostaDeLinhaEhValida,
  ehApostaDeLinha,
  BET_TYPES,
  MAX_SIMULTANEOUS_BETS,
  TOTAL_RETURN_MULTIPLIER,
  WINNING_SUMS,
} from './banca-francesa.config';
import { NIVEIS_DE_MESA, nivelPara } from '../shared/niveis-de-mesa';
import { RoadmapService, RoundRecord } from '../../roadmap/roadmap.service';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';

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
    private readonly acoes: AcoesRepetidas,
  ) {}

  /**
   * O placar reusa as mesmas cinco estradas do bacará. O mapeamento é natural: grande
   * e pequeno são os dois lados que se alternam (como banca e jogador), e ases é o
   * resultado raro que interrompe a sequência sem abrir coluna (como o empate).
   */
  getRoadmap() {
    return this.roadmapService.build(this.history);
  }

  /**
   * A configuração do jogo. Os limites daqui são os do nível de entrada (Bronze):
   * quem quiser saber o próprio limite pergunta em `/niveis/meu`, porque ele depende
   * do saldo e esta rota é pública.
   */
  getConfig() {
    return {
      minBet: NIVEIS_DE_MESA[0].minimo,
      maxBet: NIVEIS_DE_MESA[0].maximo,
      maxSimultaneousBets: MAX_SIMULTANEOUS_BETS,
      betTypes: BET_TYPES,
      winningSums: WINNING_SUMS,
      totalReturnMultiplier: TOTAL_RETURN_MULTIPLIER,
      theoreticalRtpByType: Object.fromEntries(BET_TYPES.map((type) => [type, theoreticalRtp(type)])),
    };
  }

  /**
   * O mesmo limite por nível da mesa compartilhada.
   *
   * Precisa estar aqui também: o jogo contra a casa e a mesa com gente são dois
   * caminhos até a mesma carteira, e um limite que só existe num deles é um limite que
   * não existe — bastaria apostar pelo outro.
   */
  validateBets(bets: BancaFrancesaBet[], saldo: number) {
    const nivel = nivelPara(saldo);
    if (!Array.isArray(bets) || bets.length === 0 || bets.length > MAX_SIMULTANEOUS_BETS) {
      throw new BadRequestException(`Aposte em 1 a ${MAX_SIMULTANEOUS_BETS} lugares da mesa.`);
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
      if (!Number.isFinite(bet.amount) || bet.amount < nivel.minimo || bet.amount > nivel.maximo) {
        throw new BadRequestException(
          `Na mesa ${nivel.nome}, cada aposta vai de ${nivel.minimo.toLocaleString('pt-BR')} a ${nivel.maximo.toLocaleString('pt-BR')} fichas.`,
        );
      }
      /*
       * A aposta de linha é dividida ao meio, e ficha não se parte: o saldo é inteiro.
       * Valor ímpar é recusado aqui em vez de arredondado, porque arredondar pra cima
       * levaria o RTP acima de 100% e pra baixo esconderia meia ficha de vantagem em
       * toda aposta ímpar. O aplicativo avisa antes de deixar confirmar.
       */
      if (ehApostaDeLinha(bet.type) && !apostaDeLinhaEhValida(bet.amount)) {
        throw new BadRequestException('Aposta na linha precisa ser um valor par — ela é dividida ao meio.');
      }
    }
  }

  async playRound(userId: string, bets: BancaFrancesaBet[], actionId?: string) {
    this.validateBets(bets, await this.walletService.balanceOf(userId));

    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      await this.walletService.debit(userId, totalStake, 'aposta', GAME_ID, actionId);

      const { dice, sum, outcome, rerolls, nulos } = rollUntilDecisive();
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
        /*
         * Os dados dos lançamentos que NÃO decidiram, na ordem em que saíram.
         *
         * A mesa compartilhada já mandava isto, a mesa de um jogador só não. A diferença
         * aparecia na tela: jogando sozinho, uma rodada com três nulos saltava direto pro
         * resultado, porque a tela não tinha o que lançar na tigela. Só o número de nulos
         * chegava, e número não se joga — vira um aviso escrito, que é o contrário de
         * mostrar. Com os dados na mão, as duas mesas lançam a mesma hesitação.
         */
        lancamentosNulos: nulos,
        results,
        totalStake,
        totalReturn,
        newBalance: await this.walletService.balanceOf(userId),
        roadmap: this.getRoadmap(),
      };
    });
  }
}
