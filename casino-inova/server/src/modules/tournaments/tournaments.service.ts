import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { xpDaRodada } from '../progressao/niveis';
import { WalletService } from '../wallet/wallet.service';
import { DatabaseService } from '../../database/database.service';
import {
  POINTS_SCALE,
  Tournament,
  TOURNAMENTS,
  TournamentPeriod,
  findTournament,
  windowFor,
} from './tournaments.config';

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
  constructor(
    private readonly users: UsersService,
    private readonly wallet: WalletService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Chamado por cada jogo quando uma rodada termina. `returned` é o total que voltou
   * pro jogador, não o lucro — perder tudo é `returned: 0`, e empate que devolve a
   * ficha é `returned === stake` (0 ponto, que é exatamente o certo).
   *
   * Fica FORA da transação da aposta de propósito: o resultado da rodada só se conhece
   * depois do jogo resolver, e uma rodada perdida aqui é um detalhe de ranking, não
   * uma ficha perdida — a ficha já foi movimentada pelo ledger, que é quem manda.
   */
  async recordRound(userId: string, gameId: string, stake: number, returned: number) {
    if (!Number.isFinite(stake) || stake <= 0) return;
    if (!Number.isFinite(returned) || returned < 0) return;

    /*
     * XP entra AQUI, e não em cada jogo, porque isto já é o funil por onde toda rodada
     * dos dez jogos passa. Espalhar o ganho de XP jogo a jogo seria dez lugares pra
     * esquecer um — e um jogo sem XP é uma barra que anda em nove telas e trava na
     * décima, sem ninguém entender por quê.
     *
     * Note que o XP sai do APOSTADO e ignora o `returned`: ganhar e perder valem igual.
     */
    await this.users.somarExperiencia(userId, xpDaRodada(stake));
    await this.db.query(
      'INSERT INTO tournament_rounds (user_id, game_id, stake, returned) VALUES ($1,$2,$3,$4)',
      [userId, gameId, Math.round(stake), Math.round(returned)],
    );
  }

  async listTournaments(now = new Date()) {
    await this.settleFinishedWindows(now);
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

  async leaderboard(tournamentId: string, userId?: string, now = new Date()): Promise<LeaderboardView> {
    const tournament = findTournament(tournamentId);
    if (!tournament) {
      throw new BadRequestException('Torneio não encontrado.');
    }
    await this.settleFinishedWindows(now);

    const { startsAt, endsAt } = windowFor(tournament.period, now);
    const todas = await this.rank(tournament, startsAt, endsAt);

    const me = userId ? todas.find((row) => row.userId === userId) : undefined;
    const minhasRodadas = userId ? await this.roundsOf(tournament, startsAt, endsAt, userId) : 0;

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
   * O ranking de uma janela, calculado direto no banco.
   *
   * A pontuação é proporcional à aposta — `(retorno - aposta) / aposta` — pra o
   * tamanho da ficha não mudar o ponto. Empate em pontos desempata por quem jogou
   * MENOS rodadas: chegar aos mesmos pontos em menos mãos é melhor resultado.
   *
   * `HAVING COUNT(*) >= minRounds` é o que barra quem teve uma sorte grande isolada e
   * parou de jogar.
   */
  private async rank(tournament: Tournament, startsAt: Date, endsAt: Date): Promise<LeaderboardRow[]> {
    const linhas = await this.db.query<{ user_id: string; nome: string; pontos: number; rodadas: number }>(
      `SELECT r.user_id,
              u.name AS nome,
              ROUND(SUM((r.returned - r.stake)::numeric / r.stake) * $1)::int AS pontos,
              COUNT(*)::int AS rodadas
         FROM tournament_rounds r
         JOIN users u ON u.id = r.user_id
        WHERE r.played_at >= $2 AND r.played_at < $3
          AND ($4::text[] IS NULL OR r.game_id = ANY($4))
        GROUP BY r.user_id, u.name
       HAVING COUNT(*) >= $5
        ORDER BY pontos DESC, rodadas ASC, r.user_id ASC`,
      [
        POINTS_SCALE,
        startsAt,
        endsAt,
        tournament.gameIds.length > 0 ? tournament.gameIds : null,
        tournament.minRounds,
      ],
    );

    return linhas.map((linha, indice) => ({
      position: indice + 1,
      userId: linha.user_id,
      name: linha.nome,
      points: linha.pontos,
      rounds: linha.rodadas,
      prize: tournament.prizes[indice] ?? 0,
    }));
  }

  private async roundsOf(tournament: Tournament, startsAt: Date, endsAt: Date, userId: string): Promise<number> {
    const linha = await this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM tournament_rounds
        WHERE user_id = $1 AND played_at >= $2 AND played_at < $3
          AND ($4::text[] IS NULL OR game_id = ANY($4))`,
      [userId, startsAt, endsAt, tournament.gameIds.length > 0 ? tournament.gameIds : null],
    );
    return linha?.total ?? 0;
  }

  /**
   * Paga os prêmios das janelas que já fecharam.
   *
   * Não existe cron neste servidor, então o fechamento é preguiçoso: qualquer leitura
   * de torneio confere se a janela anterior já terminou e ainda não foi paga.
   *
   * O que garante o pagamento único agora é o BANCO, não uma marca em memória: a chave
   * primária de tournament_settlements é (torneio, início da janela), e a inserção usa
   * ON CONFLICT DO NOTHING. Quem conseguir inserir a linha é quem paga; qualquer outra
   * tentativa — outra requisição ao mesmo tempo, ou o servidor reiniciando no meio —
   * não insere nada e não paga. Antes isso dependia de um Set em memória, que
   * reiniciava junto com o servidor e teria pago tudo de novo.
   */
  private async settleFinishedWindows(now: Date) {
    for (const tournament of TOURNAMENTS) {
      const anterior = this.previousWindow(tournament.period, now);

      await this.db.transaction(async (client) => {
        const { rowCount } = await client.query(
          `INSERT INTO tournament_settlements (tournament_id, window_start)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [tournament.id, anterior.startsAt],
        );
        // Já estava paga: outra requisição chegou primeiro, ou já pagamos antes.
        if (rowCount === 0) return;

        for (const row of await this.rank(tournament, anterior.startsAt, anterior.endsAt)) {
          if (row.prize <= 0) continue;
          await this.wallet.creditInTransaction(client, row.userId, row.prize, 'premio', tournament.id);
        }
      });
    }
  }

  /** A janela imediatamente anterior à aberta agora. */
  private previousWindow(period: TournamentPeriod, now: Date) {
    const atual = windowFor(period, now);
    // Um instante antes do início da janela atual cai dentro da anterior.
    const dentroDaAnterior = new Date(atual.startsAt.getTime() - 1);
    return windowFor(period, dentroDaAnterior);
  }
}
