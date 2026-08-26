import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { games } from '../data/games';
import { mockPlayer } from '../data/mockPlayer';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { ChipStack } from '../components/ChipStack';
import { LevelBadge } from '../components/LevelBadge';
import { GameTile } from '../components/GameTile';
import { useRootNavigation } from '../navigation/useRootNavigation';

export function LobbyScreen() {
  const navigation = useRootNavigation();

  const phase1Games = games.filter((game) => game.phase === 1);
  const laterGames = games.filter((game) => game.phase > 1);

  // Slots e roleta já têm motor de verdade — os outros 6 continuam na tela de mesa
  // genérica até terem o próprio motor no servidor.
  const openGame = (gameId: string) => {
    if (gameId === 'slots') {
      navigation.navigate('Slots');
    } else if (gameId === 'roleta') {
      navigation.navigate('Roulette');
    } else {
      navigation.navigate('GameTable', { gameId });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bem-vindo de volta</Text>
          <Text style={styles.playerName}>{mockPlayer.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <ChipStack amount={mockPlayer.chipBalance} />
          <LevelBadge level={mockPlayer.level} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Mesas abertas</Text>
        <View style={styles.grid}>
          {phase1Games.map((game) => (
            <GameTile
              key={game.id}
              game={game}
              playerLevel={mockPlayer.level}
              onPress={() => openGame(game.id)}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Chegando em breve</Text>
        <View style={styles.grid}>
          {laterGames.map((game) => (
            <GameTile
              key={game.id}
              game={game}
              playerLevel={mockPlayer.level}
              onPress={() => openGame(game.id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  greeting: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint },
  playerName: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
