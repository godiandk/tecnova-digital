import { View, Text, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { games } from '../data/games';
import { getGameMode } from '../data/gameModes';
import { usePlayer } from '../data/usePlayer';
import { colors, fontFamily, fontSize, spacing, useJanela, LARGURA_MAXIMA, gradeDeCartazes } from '../theme';
import { ChipStack } from '../components/ChipStack';
import { LevelBar } from '../components/LevelBar';
import { GameTile } from '../components/GameTile';
import { useRootNavigation } from '../navigation/useRootNavigation';

export function LobbyScreen() {
  const navigation = useRootNavigation();
  const { jogador } = usePlayer();

  /*
   * O layout se adapta à largura de verdade. No celular dá duas colunas; num monitor
   * daria cinco ou seis, então o conteúdo é limitado a LARGURA_MAXIMA e centralizado —
   * esticar um app de celular por 1400px deixa cartaz de 700px e barra de nível de um
   * metro.
   */
  const janela = useJanela();
  const larguraConteudo = Math.min(janela.width, LARGURA_MAXIMA) - spacing.xl * 2;
  const grade = gradeDeCartazes(larguraConteudo, spacing.lg);
  /*
   * A barra de nível é HUD, não conteúdo: esticada por 1000px ela vira uma régua e o
   * preenchimento fica ilegível. Ocupa a linha no celular e para de crescer no monitor.
   */
  const larguraBarra = Math.min(larguraConteudo, 460);

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
      <View style={[styles.header, { maxWidth: LARGURA_MAXIMA, width: '100%', alignSelf: 'center' }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Bem-vindo de volta</Text>
            <Text style={styles.playerName}>{jogador?.name ?? ''}</Text>
          </View>
          <ChipStack
            amount={jogador?.chipBalance ?? 0}
            onPressAdd={() => navigation.navigate('Tabs', { screen: 'Store' } as never)}
          />
        </View>
        <LevelBar
          level={jogador?.level ?? 1}
          xp={jogador?.xp ?? 0}
          xpToNextLevel={jogador?.xpToNextLevel ?? 500}
          width={larguraBarra}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { maxWidth: LARGURA_MAXIMA, width: '100%', alignSelf: 'center' }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Mesas abertas</Text>
        <View style={styles.grid}>
          {phase1Games.map((game) => (
            <GameTile
              key={game.id}
              game={game}
              playerLevel={jogador?.level ?? 1}
              largura={grade.largura}
              altura={grade.altura}
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
              playerLevel={jogador?.level ?? 1}
              largura={grade.largura}
              altura={grade.altura}
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
