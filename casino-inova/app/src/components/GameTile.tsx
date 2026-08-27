import { Pressable, View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Game } from '../data/games';
import { GAME_POSTERS, LOBBY_UI } from '../data/lobbyAssets';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

/**
 * Duas colunas com a margem do lobby dos dois lados e um vão no meio. Calculado
 * na largura da tela pra o cartaz não estourar em aparelho pequeno.
 */
const COLUNAS = 2;
const LARGURA = Math.floor(
  (Dimensions.get('window').width - spacing.xl * 2 - spacing.lg * (COLUNAS - 1)) / COLUNAS,
);
/** Os cartazes são 2:3 (800x1200). */
const ALTURA = Math.round(LARGURA * 1.5);

interface GameTileProps {
  game: Game;
  playerLevel: number;
  onPress: () => void;
}

/**
 * O cartaz já traz o nome do jogo escrito na arte, então aqui embaixo não repete o
 * nome — só a informação que a arte não tem (se é contra a casa ou mesa com gente,
 * e o nível que falta quando ainda está travado).
 */
export function GameTile({ game, playerLevel, onPress }: GameTileProps) {
  const locked = playerLevel < game.minLevel;
  const poster = GAME_POSTERS[game.id];

  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <View style={styles.posterFrame}>
        {poster ? (
          <Image source={poster} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.initial}>{game.name.charAt(0)}</Text>
          </View>
        )}

        {locked && (
          <>
            <LinearGradient
              colors={['rgba(11,15,13,0.55)', 'rgba(11,15,13,0.85)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.lockCenter}>
              <Image source={LOBBY_UI.seloBloqueado} style={styles.lockSeal} resizeMode="contain" />
            </View>
          </>
        )}
      </View>

      {locked ? (
        <View style={styles.lockPill}>
          <Text style={styles.lockLabel}>Abre no nível {game.minLevel}</Text>
        </View>
      ) : (
        <Text style={styles.format} numberOfLines={1}>
          {game.format === 'vs-casa' ? 'Contra a casa' : 'Mesa com gente'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: LARGURA },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  posterFrame: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  poster: { width: '100%', height: '100%' },
  posterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.felt },
  initial: { fontFamily: fontFamily.displayExtraBold, fontSize: 40, color: colors.goldBright },
  lockCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lockSeal: { width: LARGURA * 0.42, height: LARGURA * 0.42 },
  format: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  lockPill: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  lockLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.gold },
});
