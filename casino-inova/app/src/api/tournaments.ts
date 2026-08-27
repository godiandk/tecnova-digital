import { apiRequest, MOCK_USER_ID } from './client';

export type TournamentPeriod = 'diario' | 'semanal' | 'mensal';

export interface TournamentDto {
  id: string;
  name: string;
  tagline: string;
  period: TournamentPeriod;
  /** Jogos que contam. Vazio = todos. */
  gameIds: string[];
  minRounds: number;
  prizes: number[];
  startsAt: string;
  endsAt: string;
  /** Quantos pontos vale dobrar a aposta numa rodada. */
  pointsScale: number;
}

export interface LeaderboardRow {
  position: number;
  userId: string;
  name: string;
  points: number;
  rounds: number;
  prize: number;
}

export interface LeaderboardDto {
  tournament: Omit<TournamentDto, 'startsAt' | 'endsAt' | 'pointsScale'>;
  startsAt: string;
  endsAt: string;
  rows: LeaderboardRow[];
  me?: LeaderboardRow;
  roundsToQualify: number;
}

export function fetchTournaments(): Promise<TournamentDto[]> {
  return apiRequest<TournamentDto[]>('/torneios');
}

export function fetchLeaderboard(tournamentId: string): Promise<LeaderboardDto> {
  return apiRequest<LeaderboardDto>(`/torneios/${tournamentId}/ranking?userId=${MOCK_USER_ID}`);
}
