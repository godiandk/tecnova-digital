import { View, Text, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Os 8 jogos têm motor de verdade agora. Truco, dominó e pôquer são contra bot —
  // multiplayer de verdade com outro jogador ainda depende de sala + WebSocket.
  const openGame = (gameId: string) => {
    if (gameId === 'slots') {
      navigation.navigate('Slots');
    } else if (gameId === 'roleta') {
      navigation.navigate('Roulette');
    } else if (gameId === 'blackjack') {
      navigation.navigate('Blackjack');
    } else if (gameId === 'bacara') {
      navigation.navigate('Baccarat');
    } else if (gameId === 'banca-francesa') {
      navigation.navigate('BancaFrancesa');
    } else if (gameId === 'truco') {
      navigation.navigate('Truco');
    } else if (gameId === 'domino') {
      navigation.navigate('Domino');
    } else if (gameId === 'poker') {
      navigation.navigate('Poker');
    } else {
      navigation.navigate('GameTable', { gameId });
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/lobby-fundo.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(11,15,13,0.35)', colors.background]} locations={[0, 0.85]} style={StyleSheet.absoluteFillObject} />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
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
