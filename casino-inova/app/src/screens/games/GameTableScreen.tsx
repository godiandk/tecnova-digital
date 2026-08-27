import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../../navigation/types';
import { getGameById } from '../../data/games';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { colors, fontFamily, fontSize, spacing } from '../../theme';
import { Fundo } from '../../components/Fundo';

type Props = NativeStackScreenProps<RootStackParamList, 'GameTable'>;

/**
 * Tela de mesa genérica, reaproveitada pelos 8 jogos via `route.params.gameId` — a mesa
 * real (feltro, cartas, dados) de cada jogo entra aqui quando o motor de jogos existir.
 * Até lá, mostra a identidade do jogo (nome, formato, mesa mínima) usando o mesmo tom
 * visual que a mesa terá.
 */
export function GameTableScreen({ route, navigation }: Props) {
  const game = getGameById(route.params.gameId);
  const tutorial = game ? getTutorialByGameId(game.id) : undefined;

  // Abre sozinho na primeira visita da sessão. Quando existir conta de usuário
  // persistida, isso troca para "já visto por este jogador" vindo do backend, em vez
  // de reabrir toda vez que a tela é montada.
  const [tutorialVisible, setTutorialVisible] = useState(true);

  if (!game) {
    return null;
  }

  return (
    <Fundo source={TABLE_IMAGES[game.id]} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(11,15,13,0.25)', colors.background]} locations={[0, 0.8]} style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setTutorialVisible(true)} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        <View style={styles.center}>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameFormat}>
            {game.format === 'vs-casa' ? 'Jogador contra a casa' : 'Mesa multiplayer'}
          </Text>
          <View style={styles.constructionPill}>
            <Text style={styles.constructionLabel}>Regras do jogo em construção — Fase {game.phase} do roadmap</Text>
          </View>
        </View>
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName={game.name}
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </Fundo>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: StyleSheet.absoluteFillObject,
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  gameName: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xxl, color: colors.textPrimary },
  gameFormat: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  constructionPill: {
    marginTop: spacing.lg,
    backgroundColor: colors.overlay,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  constructionLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright },
});
