import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mockPlayer } from '../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { LevelBadge } from '../components/LevelBadge';

const VIP_LABEL: Record<typeof mockPlayer.vipTier, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  diamante: 'Diamante',
};

export function ProfileScreen() {
  const xpProgress = mockPlayer.xp / mockPlayer.xpToNextLevel;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBlock}>
        <View style={styles.avatar} />
        <Text style={styles.name}>{mockPlayer.name}</Text>
        <View style={styles.vipPill}>
          <Text style={styles.vipLabel}>Clube {VIP_LABEL[mockPlayer.vipTier]}</Text>
        </View>
      </View>

      <CasinoCard style={styles.levelCard}>
        <View style={styles.levelRow}>
          <LevelBadge level={mockPlayer.level} size={44} />
          <View style={styles.levelInfo}>
            <Text style={styles.levelLabel}>
              Nível {mockPlayer.level} · {mockPlayer.xp}/{mockPlayer.xpToNextLevel} XP
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(xpProgress * 100, 100)}%` }]} />
            </View>
          </View>
        </View>
      </CasinoCard>

      <View style={styles.statsRow}>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{mockPlayer.chipBalance.toLocaleString('pt-BR')}</Text>
          <Text style={styles.statLabel}>Fichas</Text>
        </CasinoCard>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{mockPlayer.friends.length}</Text>
          <Text style={styles.statLabel}>Amigos</Text>
        </CasinoCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  headerBlock: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  name: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  vipPill: { backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  vipLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright },
  levelCard: { marginBottom: spacing.lg },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelInfo: { flex: 1, gap: spacing.xs },
  levelLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.goldBright },
  statsRow: { flexDirection: 'row', gap: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  statLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
});
