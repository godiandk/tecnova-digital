import { View, Text, StyleSheet, ScrollView, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { games } from '../data/games';
import { getGameMode } from '../data/gameModes';
import { mockPlayer } from '../data/mockPlayer';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { ChipStack } from '../components/ChipStack';
import { LevelBar } from '../components/LevelBar';
import { GameTile } from '../components/GameTile';
import { useRootNavigation } from '../navigation/useRootNavigation';

/** A barra de nível ocupa a linha inteira, descontada a margem lateral do lobby. */
const LARGURA_BARRA = Dimensions.get('window').width - spacing.xl * 2;

export function LobbyScreen() {
  const navigation = useRootNavigation();

  const phase1Games = games.filter((game) => game.phase === 1);
  const laterGames = games.filter((game) => game.phase > 1);

  /**
   * Jogo sem variante abre direto; jogo com mais de um jeito de jogar passa pela tela
   * de escolha. Quem decide é gameModes.ts — o lobby não conhece rota de jogo nenhuma,
   * então acrescentar um modo novo não mexe aqui.
   */
  const openGame = (gameId: string) => {
    const mode = getGameMode(gameId);
    if (mode?.kind === 'direto' && mode.route) {
      navigation.navigate(mode.route as never);
      return;
    }
    if (mode?.kind === 'escolher') {
      navigation.navigate('GameMode', { gameId });
      return;
    }
    navigation.navigate('GameTable', { gameId });
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Bem-vindo de volta</Text>
            <Text style={styles.playerName}>{mockPlayer.name}</Text>
          </View>
          <ChipStack
            amount={mockPlayer.chipBalance}
            onPressAdd={() => navigation.navigate('Tabs', { screen: 'Store' } as never)}
          />
        </View>
        <LevelBar
          level={mockPlayer.level}
          xp={mockPlayer.xp}
          xpToNextLevel={mockPlayer.xpToNextLevel}
          width={LARGURA_BARRA}
        />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint },
  playerName: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
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
