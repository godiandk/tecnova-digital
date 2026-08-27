import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Uma volta inteira leva quase um minuto: tem que dar pra não perceber olhando. */
const CICLO_EM_MS = 52_000;

/**
 * A luz que passeia devagar no fundo do salão.
 *
 * É o item 4 do docs/design-atencao-visual.md: o que prende o olho não é o que se mexe
 * no meio da leitura, é o que se mexe no canto. Cassino resolve isso com luz de teto
 * que corre; aqui é um halo dourado bem fraco que atravessa a tela em um minuto.
 *
 * Fraca e lenta de propósito. Se der pra notar que está se movendo, está errado — vira
 * distração em cima do conteúdo em vez de vida no ambiente.
 */
export function LuzAmbiente() {
  const avanco = useSharedValue(0);

  useEffect(() => {
    avanco.value = withRepeat(
      withTiming(1, { duration: CICLO_EM_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [avanco]);

  const animado = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(avanco.value, [0, 1], [-90, 90]) },
      { translateY: interpolate(avanco.value, [0, 1], [-40, 30]) },
    ],
    opacity: interpolate(avanco.value, [0, 0.5, 1], [0.5, 1, 0.5]),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.halo, animado]}>
      <LinearGradient
        colors={['rgba(229,181,103,0.11)', 'rgba(229,181,103,0.03)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Maior que a tela e sangrando pra fora: assim a borda do halo nunca aparece.
  halo: {
    position: 'absolute',
    top: -160,
    left: -80,
    right: -80,
    height: 520,
    borderRadius: 400,
    overflow: 'hidden',
  },
});
