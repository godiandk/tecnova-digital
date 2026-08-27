import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import {
  POINTS_SCALE,
  Tournament,
  TOURNAMENTS,
  TournamentPeriod,
  findTournament,
  windowFor,
} from './tournaments.config';

/**
 * Uma rodada disputada. O torneio guarda a estatística esportiva (o que foi apostado e
 * o que voltou); quem manda em ficha continua sendo só o ledger da carteira. Duas
 * responsabilidades separadas de propósito — nenhum ponto de torneio move saldo, e
 * nenhum prêmio de torneio é creditado fora do ledger.
 */
export interface TournamentRound {
  userId: string;
  gameId: string;
  /** O que foi apostado na rodada. */
  stake: number;
  /** O que voltou pro jogador (0 quando perdeu tudo). */
  returned: number;
  at: string;
}

export interface LeaderboardRow {
  position: number;
  userId: string;
  name: string;
  points: number;
  rounds: number;
  /** Prêmio em fichas que essa posição leva, se o torneio fechasse agora. */
  prize: number;
}

export interface LeaderboardView {
  tournament: Tournament;
  startsAt: string;
  endsAt: string;
  rows: LeaderboardRow[];
  /** A linha de quem pediu, mesmo que esteja fora do pedaço mostrado. */
  me?: LeaderboardRow;
  /** Quantas rodadas ainda faltam pra quem pediu entrar no ranking. */
  roundsToQualify: number;
}

/** Quantas posições a tela mostra. */
const VISIBLE_ROWS = 20;

@Injectable()
export class TournamentsService {
  private readonly rounds: TournamentRound[] = [];
  /** Janelas já premiadas: `${tournamentId}:${startsAt}`. Evita pagar duas vezes. */
  private readonly settled = new Set<string>();

  constructor(
    private readonly users: UsersService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Chamado por cada jogo quando uma rodada termina. `returned` é o total que voltou
   * pro jogador, não o lucro — perder tudo é `returned: 0`, e empate que devolve a
   * ficha é `returned === stake` (0 ponto, que é exatamente o certo).
   */
  recordRound(userId: string, gameId: string, stake: number, returned: number) {
    if (!Number.isFinite(stake) || stake <= 0) return;
    if (!Number.isFinite(returned) || returned < 0) return;
    this.rounds.push({ userId, gameId, stake, returned, at: new Date().toISOString() });
  }

  listTournaments(now = new Date()) {
    this.settleFinishedWindows(now);
    return TOURNAMENTS.map((tournament) => {
      const { startsAt, endsAt } = windowFor(tournament.period, now);
      return {
        ...tournament,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        pointsScale: POINTS_SCALE,
      };
    });
  }

  leaderboard(tournamentId: string, userId?: string, now = new Date()): LeaderboardView {
    const tournament = findTournament(tournamentId);
    if (!tournament) {
      throw new BadRequestException('Torneio não encontrado.');
    }
    this.settleFinishedWindows(now);

    const { startsAt, endsAt } = windowFor(tournament.period, now);
    const todas = this.rank(tournament, startsAt, endsAt);

    const me = userId ? todas.find((row) => row.userId === userId) : undefined;
    const minhasRodadas = userId ? this.roundsOf(tournament, startsAt, endsAt, userId) : 0;

    return {
      tournament,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      rows: todas.slice(0, VISIBLE_ROWS),
      me,
      roundsToQualify: Math.max(0, tournament.minRounds - minhasRodadas),
    };
  }

  /**
   * O ranking de uma janela. Só entra quem bateu o mínimo de rodadas — sem isso, uma
   * única rodada de sorte grande travaria o topo do torneio inteiro.
   *
   * Empate em pontos desempata por quem jogou menos rodadas: chegar aos mesmos pontos
   * em menos mãos é melhor resultado.
   */
  private rank(tournament: Tournament, startsAt: Date, endsAt: Date): LeaderboardRow[] {
    const porJogador = new Map<string, { points: number; rounds: number }>();

    for (const round of this.roundsIn(tournament, startsAt, endsAt)) {
      const atual = porJogador.get(round.userId) ?? { points: 0, rounds: 0 };
      // Proporcional à aposta: o tamanho da ficha não muda a pontuação.
      atual.points += ((round.returned - round.stake) / round.stake) * POINTS_SCALE;
      atual.rounds += 1;
      porJogador.set(round.userId, atual);
    }

    return [...porJogador.entries()]
      .filter(([, dados]) => dados.rounds >= tournament.minRounds)
      .map(([userId, dados]) => ({ userId, points: Math.round(dados.points), rounds: dados.rounds }))
      .sort((a, b) => b.points - a.points || a.rounds - b.rounds)
      .map((linha, indice) => ({
        position: indice + 1,
        userId: linha.userId,
        name: this.users.findById(linha.userId)?.name ?? linha.userId,
        points: linha.points,
        rounds: linha.rounds,
        prize: tournament.prizes[indice] ?? 0,
      }));
  }

  private roundsIn(tournament: Tournament, startsAt: Date, endsAt: Date): TournamentRound[] {
    const inicio = startsAt.getTime();
    const fim = endsAt.getTime();
    return this.rounds.filter((round) => {
      if (tournament.gameIds.length > 0 && !tournament.gameIds.includes(round.gameId)) return false;
      const quando = new Date(round.at).getTime();
      return quando >= inicio && quando < fim;
    });
  }

  private roundsOf(tournament: Tournament, startsAt: Date, endsAt: Date, userId: string): number {
    return this.roundsIn(tournament, startsAt, endsAt).filter((round) => round.userId === userId).length;
  }

  /**
   * Paga os prêmios das janelas que já fecharam.
   *
   * Não existe cron neste servidor, então o fechamento é preguiçoso: qualquer leitura
   * de torneio confere se a janela anterior já terminou e ainda não foi paga. É
   * idempotente — a janela paga entra no `settled` e nunca é paga de novo.
   *
   * Quando o backend ganhar persistência de verdade, isto vira uma tarefa agendada e
   * o `settled` vira tabela; a regra de quem ganha o quê continua exatamente esta.
   */
  private settleFinishedWindows(now: Date) {
    for (const tournament of TOURNAMENTS) {
      const anterior = this.previousWindow(tournament.period, now);
      const chave = `${tournament.id}:${anterior.startsAt.toISOString()}`;
      if (this.settled.has(chave)) continue;
      this.settled.add(chave);

      for (const row of this.rank(tournament, anterior.startsAt, anterior.endsAt)) {
        if (row.prize <= 0) continue;
        this.wallet.credit(row.userId, row.prize, 'premio', tournament.id);
      }
    }
  }

  /** A janela imediatamente anterior à aberta agora. */
  private previousWindow(period: TournamentPeriod, now: Date) {
    const atual = windowFor(period, now);
    // Um instante antes do início da janela atual cai dentro da anterior.
    const dentroDaAnterior = new Date(atual.startsAt.getTime() - 1);
    return windowFor(period, dentroDaAnterior);
  }

  /** Só pros testes e pro roteiro de verificação. */
  clearForTesting() {
    this.rounds.length = 0;
    this.settled.clear();
  }
}
