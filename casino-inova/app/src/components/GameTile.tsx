import { Pressable, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Game } from '../data/games';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

const ACCENT_GRADIENTS: Record<Game['accent'], [string, string]> = {
  gold: [colors.goldBright, colors.goldDeep],
  felt: [colors.feltBright, colors.felt],
  ruby: [colors.ruby, '#8C2434'],
  sapphire: [colors.sapphire, '#20488C'],
};

interface GameTileProps {
  game: Game;
  playerLevel: number;
  onPress: () => void;
}

export function GameTile({ game, playerLevel, onPress }: GameTileProps) {
  const locked = playerLevel < game.minLevel;

  return (
    <Pressable onPress={locked ? undefined : onPress} style={styles.wrapper} disabled={locked}>
      <LinearGradient colors={ACCENT_GRADIENTS[game.accent]} style={styles.gradient}>
        <Text style={styles.initial}>{game.name.charAt(0)}</Text>
      </LinearGradient>
      <Text style={styles.name} numberOfLines={1}>
        {game.name}
      </Text>
      {locked ? (
        <View style={styles.lockPill}>
          <Text style={styles.lockLabel}>Nível {game.minLevel}</Text>
        </View>
      ) : (
        <Text style={styles.format}>{game.format === 'vs-casa' ? 'Contra a casa' : 'Mesa multiplayer'}</Text>
      )}
      {locked && <View style={styles.lockedOverlay} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 128,
  },
  gradient: {
    width: 128,
    height: 128,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 128,
    borderRadius: radius.lg,
    backgroundColor: colors.overlay,
  },
  initial: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 40,
    color: colors.background,
  },
  name: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  format: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
  },
  lockPill: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  lockLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
