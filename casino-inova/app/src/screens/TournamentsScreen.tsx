import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { MOCK_USER_ID } from '../api/client';
import { fetchLeaderboard, fetchTournaments, LeaderboardDto, TournamentDto } from '../api/tournaments';
import { getGameById } from '../data/games';

const PERIOD_LABEL: Record<string, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

/** Quanto falta pra janela fechar, escrito do jeito que a pessoa fala. */
function tempoRestante(endsAtIso: string): string {
  const restante = new Date(endsAtIso).getTime() - Date.now();
  if (restante <= 0) return 'encerrando';

  const horas = Math.floor(restante / 3_600_000);
  if (horas >= 48) return `faltam ${Math.floor(horas / 24)} dias`;
  if (horas >= 1) return `faltam ${horas}h`;
  return `faltam ${Math.max(1, Math.floor(restante / 60_000))} min`;
}

function nomesDosJogos(gameIds: string[]): string {
  if (gameIds.length === 0) return 'Todos os jogos';
  return gameIds.map((id) => getGameById(id)?.name ?? id).join(', ');
}

export function TournamentsScreen() {
  const [tournaments, setTournaments] = useState<TournamentDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (tournamentId?: string) => {
    setError(null);
    try {
      const lista = await fetchTournaments();
      setTournaments(lista);
      const alvo = tournamentId ?? selectedId ?? lista[0]?.id;
      if (!alvo) return;
      setSelectedId(alvo);
      setBoard(await fetchLeaderboard(alvo));
    } catch {
      setError('Não deu pra falar com o servidor. Confira se ele está no ar.');
    }
  }, [selectedId]);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
    // Só na montagem: trocar de torneio tem o seu próprio caminho abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trocarTorneio = async (id: string) => {
    setSelectedId(id);
    setBoard(null);
    try {
      setBoard(await fetchLeaderboard(id));
    } catch {
      setError('Não deu pra carregar esse torneio.');
    }
  };

  const atualizar = async () => {
    setRefreshing(true);
    await carregar(selectedId ?? undefined);
    setRefreshing(false);
  };

  const torneio = tournaments.find((item) => item.id === selectedId);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.goldBright} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Torneios &amp; ranking</Text>

      <View style={styles.tabs}>
        {tournaments.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => trocarTorneio(item.id)}
            style={[styles.tab, item.id === selectedId && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, item.id === selectedId && styles.tabLabelActive]}>
              {PERIOD_LABEL[item.period] ?? item.period}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={atualizar} tintColor={colors.goldBright} />}
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {torneio && (
          <CasinoCard style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.tournamentName}>{torneio.name}</Text>
              <View style={styles.clock}>
                <Ionicons name="time-outline" size={13} color={colors.goldBright} />
                <Text style={styles.clockText}>{tempoRestante(torneio.endsAt)}</Text>
              </View>
            </View>
            <Text style={styles.tagline}>{torneio.tagline}</Text>

            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Jogos que contam</Text>
              <Text style={styles.factValue}>{nomesDosJogos(torneio.gameIds)}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Mínimo pra entrar</Text>
              <Text style={styles.factValue}>{torneio.minRounds} rodadas</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Prêmio do 1º lugar</Text>
              <Text style={styles.factValue}>{torneio.prizes[0]?.toLocaleString('pt-BR')} fichas</Text>
            </View>
          </CasinoCard>
        )}

        {/*
          A regra de pontuação fica escrita na tela, não escondida no código. É a
          mesma promessa do RTP divulgado em cada jogo: a pessoa entende como se
          ganha antes de jogar.
        */}
        {torneio && (
          <View style={styles.ruleBox}>
            <Ionicons name="information-circle-outline" size={15} color={colors.goldBright} />
            <Text style={styles.ruleText}>
              Cada rodada vale pontos <Text style={styles.ruleStrong}>proporcionais ao que voltou</Text>: dobrar a
              aposta vale +{torneio.pointsScale}, perder tudo vale −{torneio.pointsScale}. Apostar 10 fichas ou 10.000
              dá exatamente os mesmos pontos — aqui o ranking mede acerto, não quanto você gastou.
            </Text>
          </View>
        )}

        {board?.me === undefined && board !== null && board.roundsToQualify > 0 && (
          <View style={styles.qualifyBox}>
            <Text style={styles.qualifyText}>
              Faltam <Text style={styles.ruleStrong}>{board.roundsToQualify} rodadas</Text> pra você entrar neste
              ranking.
            </Text>
          </View>
        )}

        {board === null ? (
          <ActivityIndicator color={colors.goldBright} style={styles.loadingRows} />
        ) : board.rows.length === 0 ? (
          <Text style={styles.empty}>Ninguém se classificou ainda. Vai que a primeira colocação é sua.</Text>
        ) : (
          board.rows.map((row) => {
            const souEu = row.userId === MOCK_USER_ID;
            return (
              <CasinoCard key={row.userId} style={[styles.row, souEu && styles.rowSelf]}>
                <Text style={[styles.position, row.position <= 3 && styles.positionTop]}>{row.position}º</Text>
                <View style={styles.rowMiddle}>
                  <Text style={[styles.rowName, souEu && styles.rowNameSelf]}>{souEu ? 'Você' : row.name}</Text>
                  <Text style={styles.rowRounds}>{row.rounds} rodadas</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowPoints, row.points < 0 && styles.rowPointsNegative]}>
                    {row.points > 0 ? '+' : ''}
                    {row.points.toLocaleString('pt-BR')} pts
                  </Text>
                  {row.prize > 0 && <Text style={styles.rowPrize}>{row.prize.toLocaleString('pt-BR')} fichas</Text>}
                </View>
              </CasinoCard>
            );
          })
        )}

        {board?.me && board.me.position > board.rows.length && (
          <>
            <Text style={styles.yourPositionLabel}>Sua posição</Text>
            <CasinoCard style={[styles.row, styles.rowSelf]}>
              <Text style={styles.position}>{board.me.position}º</Text>
              <View style={styles.rowMiddle}>
                <Text style={[styles.rowName, styles.rowNameSelf]}>Você</Text>
                <Text style={styles.rowRounds}>{board.me.rounds} rodadas</Text>
              </View>
              <Text style={[styles.rowPoints, board.me.points < 0 && styles.rowPointsNegative]}>
                {board.me.points > 0 ? '+' : ''}
                {board.me.points.toLocaleString('pt-BR')} pts
              </Text>
            </CasinoCard>
          </>
        )}

        {torneio && (
          <Text style={styles.footnote}>
            Prêmios são creditados em fichas quando a janela fecha, e aparecem no seu extrato com o nome do torneio.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.felt },
  tabLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textFaint },
  tabLabelActive: { color: colors.textPrimary },
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  error: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.sm },
  headerCard: { gap: 6 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tournamentName: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clockText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright },
  tagline: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginBottom: spacing.xs },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  factLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  factValue: { flex: 1, textAlign: 'right', fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.textSecondary },
  ruleBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.md,
  },
  ruleText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 17 },
  ruleStrong: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  qualifyBox: {
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    padding: spacing.md,
  },
  qualifyText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  loadingRows: { marginTop: spacing.xl },
  empty: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowSelf: { borderColor: colors.goldBright, borderWidth: 1 },
  position: { width: 34, fontFamily: fontFamily.displayBold, fontSize: fontSize.base, color: colors.textFaint },
  positionTop: { color: colors.goldBright },
  rowMiddle: { flex: 1 },
  rowName: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.textPrimary },
  rowNameSelf: { color: colors.goldBright, fontFamily: fontFamily.bodySemiBold },
  rowRounds: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  rowRight: { alignItems: 'flex-end' },
  rowPoints: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textSecondary },
  rowPointsNegative: { color: colors.danger },
  rowPrize: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.goldBright },
  yourPositionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textFaint,
    marginTop: spacing.lg,
  },
  footnote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
