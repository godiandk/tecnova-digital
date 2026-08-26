import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { LevelBadge } from '../components/LevelBadge';

type Period = 'diario' | 'semanal' | 'mensal';

const PERIOD_LABEL: Record<Period, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

const MOCK_LEADERBOARD = [
  { position: 1, name: 'Marina', points: 18420 },
  { position: 2, name: 'Diego', points: 16110 },
  { position: 3, name: 'Você', points: 14980 },
  { position: 4, name: 'Paula', points: 12040 },
  { position: 5, name: 'Rafael', points: 9870 },
];

export function TournamentsScreen() {
  const [period, setPeriod] = useState<Period>('diario');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Torneios &amp; ranking</Text>

      <View style={styles.tabs}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
          <Pressable key={key} onPress={() => setPeriod(key)} style={[styles.tab, period === key && styles.tabActive]}>
            <Text style={[styles.tabLabel, period === key && styles.tabLabelActive]}>{PERIOD_LABEL[key]}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={MOCK_LEADERBOARD}
        keyExtractor={(item) => String(item.position)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CasinoCard style={styles.row}>
            <LevelBadge level={item.position} size={30} />
            <Text style={[styles.rowName, item.name === 'Você' && styles.rowNameSelf]}>{item.name}</Text>
            <Text style={styles.rowPoints}>{item.points.toLocaleString('pt-BR')} pts</Text>
          </CasinoCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.lg },
  tabs: { flexDirection: 'row', backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.felt },
  tabLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textFaint },
  tabLabelActive: { color: colors.textPrimary },
  list: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowName: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.textPrimary },
  rowNameSelf: { color: colors.goldBright, fontFamily: fontFamily.bodySemiBold },
  rowPoints: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textSecondary },
});
