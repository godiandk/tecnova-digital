import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Game } from '../data/games';
import { GAME_POSTERS, LOBBY_UI } from '../data/lobbyAssets';
import { Entrada, Pressionavel } from '../animation';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface GameTileProps {
  game: Game;
  playerLevel: number;
  /** Vem do lobby, que é quem sabe quantas colunas cabem na tela agora. */
  largura: number;
  altura: number;
  /** Posição na grade — define o atraso da entrada em cascata. */
  indice: number;
  onPress: () => void;
}

/**
 * O cartaz já traz o nome do jogo escrito na arte, então aqui embaixo não repete o
 * nome — só a informação que a arte não tem (se é contra a casa ou mesa com gente, e o
 * nível que falta quando ainda está travado).
 *
 * Só que nome dentro de imagem não existe pra leitor de tela, nem pra busca, nem pra
 * tradução: sem o rótulo abaixo, o cartão inteiro se anuncia como "Contra a casa" e os
 * nove jogos ficam indistinguíveis pra quem não enxerga a arte. Por isso o nome vai no
 * accessibilityLabel mesmo não aparecendo escrito.
 */
export function GameTile({ game, playerLevel, largura, altura, indice, onPress }: GameTileProps) {
  const locked = playerLevel < game.minLevel;
  const poster = GAME_POSTERS[game.id];

  return (
    <Entrada indice={indice}>
      <Pressionavel
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? `${game.name} — abre no nível ${game.minLevel}`
            : `${game.name} — ${game.format === 'vs-casa' ? 'contra a casa' : 'mesa com gente'}`
        }
        style={{ width: largura }}
      >
      <View style={[styles.posterFrame, { width: largura, height: altura }]}>
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
              <Image
                source={LOBBY_UI.seloBloqueado}
                style={{ width: largura * 0.42, height: largura * 0.42 }}
                resizeMode="contain"
              />
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
      </Pressionavel>
    </Entrada>
  );
}

const styles = StyleSheet.create({
  posterFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  poster: { width: '100%', height: '100%' },
  posterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.felt },
  initial: { fontFamily: fontFamily.displayExtraBold, fontSize: 40, color: colors.goldBright },
  lockCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
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
