import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface BrilhoProps {
  /** Largura da área que vai brilhar — precisa ser conhecida pra faixa atravessar. */
  largura: number;
  /** Segundos entre uma passada e a próxima. Longo de propósito: ver o item 4 do doc. */
  intervalo?: number;
  /** Atraso inicial, pra dois elementos vizinhos não brilharem em uníssono. */
  atraso?: number;
  cor?: string;
  style?: ViewStyle;
}

const DURACAO_DA_PASSADA = 900;

/**
 * A faixa de luz que atravessa uma superfície dourada de tempos em tempos.
 *
 * É o recurso do item 2 do docs/design-atencao-visual.md: ouro parado é uma cor, ouro
 * com reflexo que anda é material. A faixa é diagonal e estreita porque reflexo de
 * metal escovado é assim — faixa larga e reta parece varredura de scanner.
 *
 * Fica atrás de um `overflow: hidden` de quem chama, senão a luz vaza pra fora da peça.
 */
export function Brilho({ largura, intervalo = 6, atraso = 0, cor = 'rgba(255,255,255,0.28)', style }: BrilhoProps) {
  const avanco = useSharedValue(0);

  useEffect(() => {
    const cicloEmMs = intervalo * 1000;
    avanco.value = 0;
    avanco.value = withDelay(
      atraso,
      withRepeat(
        withTiming(1, {
          duration: cicloEmMs,
          // A luz cruza no comecinho do ciclo e o resto é espera. `bezier` faz isso sem
          // precisar de dois passos encadeados: sobe rápido e fica parada no fim.
          easing: Easing.bezier(0, 0, DURACAO_DA_PASSADA / cicloEmMs, 1),
        }),
        -1,
        false,
      ),
    );
  }, [avanco, intervalo, atraso]);

  const faixa = Math.max(80, largura * 0.35);

  const animado = useAnimatedStyle(() => ({
    transform: [{ translateX: -faixa + avanco.value * (largura + faixa * 2) }, { rotate: '18deg' }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.recorte, style]}>
      <Animated.View style={[styles.faixa, { width: faixa }, animado]}>
        <LinearGradient
          colors={['transparent', cor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  recorte: { overflow: 'hidden' },
  // Mais alta que a peça: inclinada em 18°, uma faixa da altura exata deixaria canto sem luz.
  faixa: { position: 'absolute', top: '-40%', bottom: '-40%' },
});
