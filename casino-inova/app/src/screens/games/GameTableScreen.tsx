import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../../navigation/types';
import { getGameById } from '../../data/games';
import { colors, fontFamily, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GameTable'>;

const ACCENT_GRADIENTS = {
  gold: [colors.goldDeep, colors.background],
  felt: [colors.felt, colors.background],
  ruby: ['#8C2434', colors.background],
  sapphire: ['#20488C', colors.background],
} as const;

/**
 * Tela de mesa genérica, reaproveitada pelos 8 jogos via `route.params.gameId` — a mesa
 * real (feltro, cartas, dados) de cada jogo entra aqui quando o motor de jogos existir.
 * Até lá, mostra a identidade do jogo (nome, formato, mesa mínima) usando o mesmo tom
 * visual que a mesa terá.
 */
export function GameTableScreen({ route, navigation }: Props) {
  const game = getGameById(route.params.gameId);

  if (!game) {
    return null;
  }

  return (
    <LinearGradient colors={ACCENT_GRADIENTS[game.accent]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameFormat}>
            {game.format === 'vs-casa' ? 'Jogador contra a casa' : 'Mesa multiplayer'} · imagem de referência:{' '}
            {game.tableImageKey}.png
          </Text>
          <View style={styles.constructionPill}>
            <Text style={styles.constructionLabel}>Mesa em construção — Fase {game.phase} do roadmap</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
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
