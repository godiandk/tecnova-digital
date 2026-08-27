import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { games } from '../data/games';
import { getGameMode } from '../data/gameModes';
import { usePlayer } from '../data/usePlayer';
import { colors, fontFamily, fontSize, spacing, useJanela, LARGURA_MAXIMA, gradeDeCartazes } from '../theme';
import { ChipStack } from '../components/ChipStack';
import { LevelBar } from '../components/LevelBar';
import { GameTile } from '../components/GameTile';
import { Destaque } from '../components/Destaque';
import { TrilhoDourado } from '../components/TrilhoDourado';
import { FitaDeGanhos } from '../components/FitaDeGanhos';
import { Fundo } from '../components/Fundo';
import { LuzAmbiente } from '../components/LuzAmbiente';
import { useRootNavigation } from '../navigation/useRootNavigation';

/**
 * Qual mesa vai pro destaque.
 *
 * Roda pelo dia do mês, então o salão não abre igual todo dia — é o mesmo motivo pelo
 * qual cassino troca a mesa da vitrine. Determinístico de propósito: sorteio a cada
 * abertura faria o destaque piscar entre um jogo e outro a cada volta pro lobby.
 */
function mesaEmDestaque() {
  return games[new Date().getDate() % games.length];
}

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

  const destaque = mesaEmDestaque();
  /*
   * As seções separam o que muda a experiência: mesa com gente tem chat, parceiro e
   * espera; contra a casa abre e joga. Antes eram dez cartazes numa fileira só, o que
   * escondia essa diferença.
   */
  const contraACasa = games.filter((jogo) => jogo.format === 'vs-casa' && jogo.id !== destaque.id);
  const comGente = games.filter((jogo) => jogo.format === 'mesa-multiplayer' && jogo.id !== destaque.id);

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

  const secao = (titulo: string, lista: typeof games, deslocamento: number) => (
    <View style={styles.secao}>
      <TrilhoDourado titulo={titulo} contagem={lista.length} />
      <View style={styles.grid}>
        {lista.map((game, indice) => (
          <GameTile
            key={game.id}
            indice={deslocamento + indice}
            game={game}
            playerLevel={jogador?.level ?? 1}
            largura={grade.largura}
            altura={grade.altura}
            onPress={() => openGame(game.id)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Fundo source={require('../../assets/images/backgrounds/lobby-fundo.jpg')} style={styles.background}>
      <LinearGradient colors={['rgba(11,15,13,0.35)', colors.background]} locations={[0, 0.85]} style={StyleSheet.absoluteFillObject} />
      {/* Movimento na periferia — item 4 do docs/design-atencao-visual.md. */}
      <LuzAmbiente />
      <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, styles.centrado]}>
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
        contentContainerStyle={[styles.scrollContent, styles.centrado]}
        showsVerticalScrollIndicator={false}
      >
        <FitaDeGanhos />

        <Destaque game={destaque} largura={larguraConteudo} onPress={() => openGame(destaque.id)} />

        {secao('Mesas com gente', comGente, 1)}
        {secao('Contra a casa', contraACasa, 1 + comGente.length)}
      </ScrollView>
      </SafeAreaView>
    </Fundo>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  centrado: { maxWidth: LARGURA_MAXIMA, width: '100%', alignSelf: 'center' },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint },
  playerName: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  secao: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
