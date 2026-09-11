import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { spin, theoreticalRtp } from './slots.engine';
import { MAIOR_MULTIPLICADOR, MIN_MATCH, PAYLINES, REELS, ROWS, SLOT_SYMBOLS } from './slots.config';
import { AcoesRepetidas } from '../shared/acoes-repetidas.service';
import { MaquinaDeRodada } from '../core/maquina-de-rodada';
import { DegrauDoJogador } from '../shared/degrau-do-jogador.service';
import { FaixaDeAposta } from '../shared/faixa-de-aposta';
import { NIVEIS_DE_MESA, problemaComAAposta } from '../shared/niveis-de-mesa';

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'slots';

@Injectable()
export class SlotsService {
  constructor(
    private readonly walletService: WalletService,
    private readonly faixas: FaixaDeAposta,
    private readonly degraus: DegrauDoJogador,
    private readonly tournaments: TournamentsService,
    private readonly acoes: AcoesRepetidas,
    private readonly maquina: MaquinaDeRodada,
  ) {}

    /*
   * A CONFIGURAÇÃO PASSOU A DEPENDER DE QUEM PERGUNTA.
   *
   * Ela publicava `NIVEIS_DE_MESA[0].minimo` — o mínimo do BRONZE — pra todo mundo. Na
   * tela de quem tem bilhões isso virava "o mínimo é 500.000.000" ao lado de um trilho
   * oferecendo fichas de 50: nenhuma combinação de fichas alcançava o mínimo, e a mesa
   * ficava matematicamente inutilizável.
   *
   * Agora a faixa vem de `FaixaDeAposta`, que é a fonte única — ver o arquivo dela.
   */
  async getConfig(userId: string) {
    const faixa = await this.faixas.de(userId, 1, MAIOR_MULTIPLICADOR);
    return {
      ...faixa,
      symbols: SLOT_SYMBOLS,
      /** Formato da grade e linhas vão junto: a tela desenha a partir daqui, sem cópia própria. */
      reels: REELS,
      rows: ROWS,
      paylines: PAYLINES,
      minMatch: MIN_MATCH,
      minBet: faixa.minBet,
      maxBet: faixa.maxBet,
      theoreticalRtp: theoreticalRtp(),
    };
  }

  /**
   * Debita a aposta antes de girar (se não tiver saldo, nem gira), gira, credita o
   * prêmio se houver, e devolve o resultado inteiro — cliente não decide nada disso,
   * só mostra o que o servidor sorteou.
   */
  async playSpin(userId: string, bet: number, actionId?: string) {
    /*
     * Quem é esta pessoa economicamente: saldo, nível e o degrau que os dois liberam.
     * O degrau é `min(o que o saldo banca, o que o nível liberou)` — comprar fichas dá
     * mais rodadas na mesa dela, não passagem pra mesa de cima.
     */
    const quem = await this.degraus.de(userId);
    const problema = problemaComAAposta(bet, quem.saldo, quem.nivel, MAIOR_MULTIPLICADOR);
    if (problema) throw new BadRequestException(problema);

    /*
     * Daqui pra baixo é a rodada em si: debitar, sortear, pagar. Vai dentro de
     * `umaVezSo` porque repetir a mesma ação não pode gerar rodada nova — só a
     * carteira ser idempotente deixava o jogador pagar uma rodada e ganhar várias.
     */
    return this.acoes.umaVezSo(userId, actionId, async () => {
      /*
       * A RODADA É REGISTRADA ANTES DE O DINHEIRO SE MEXER. Ver MaquinaDeRodada: se o
       * processo morrer entre o débito e o registro, sobra dinheiro movido sem nada que
       * o explique.
       */
      const rodada = await this.maquina.comecar({ jogo: GAME_ID, usuarioId: userId, apostas: { valor: bet } });
      await this.walletService.debit(userId, bet, 'aposta', GAME_ID, actionId, rodada.id);
      const result = spin(bet);

      if (result.totalWin > 0) {
        await this.walletService.credit(userId, result.totalWin, 'premio', GAME_ID, undefined, rodada.id);
      }
      await this.tournaments.recordRound(userId, GAME_ID, bet, result.totalWin, quem.saldo);
      await rodada.terminar({
        resultado: { grade: result.grid, linhas: result.winningLines.map((l) => l.payline) },
        apostado: bet,
        retorno: result.totalWin,
      });

      return { ...result, bet, newBalance: await this.walletService.balanceOf(userId) };
    });
  }
}
