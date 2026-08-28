import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BACBO_DIE_BLURRED, BACBO_DIE_IMAGES, DIE_FACE_IMAGES } from '../data/gameAssets';
import { MOLA } from '../animation';

interface DadoProps {
  /** A face que o servidor sorteou, ou null enquanto ainda está rolando. */
  face: number | null;
  rolando: boolean;
  /** Posição na mesa — cada dado para um pouco depois do anterior. */
  indice?: number;
  tamanho?: number;
  /** O dado do Bac Bo tem arte própria; os outros usam o dado da marca. */
  bacBo?: boolean;
}

/** Quanto tempo cada face fica na tela durante a troca rápida. */
const QUADRO_EM_MS = 70;

/** Cada dado assenta um pouco depois do anterior, como quando caem no feltro. */
const ATRASO_POR_DADO = 130;

/**
 * Um dado.
 *
 * Rolando, ele salta e gira trocando de face depressa. Quando o resultado chega, cai
 * na face sorteada com um quique curto.
 *
 * O Bac Bo tem um quadro BORRADO próprio na arte, feito pra isso: durante o salto é ele
 * que aparece, e o dado lê como um objeto girando rápido demais pra o olho acompanhar,
 * em vez de seis desenhos piscando. Nos outros jogos o efeito é a troca rápida das
 * faces mesmo — as seis foram geradas na mesma posição, então a troca não treme.
 *
 * Como no rolo e na roleta, a animação não decide nada: a face já veio do servidor.
 */
export function Dado({ face, rolando, indice = 0, tamanho = 56, bacBo = false }: DadoProps) {
  const faces = bacBo ? BACBO_DIE_IMAGES : DIE_FACE_IMAGES;
  const salto = useSharedValue(0);
  const giro = useSharedValue(0);
  const assentar = useSharedValue(face ? 1 : 0);
  const [quadro, setQuadro] = useState(1);

  // Troca de face enquanto rola. Só serve pro dado sem quadro borrado.
  useEffect(() => {
    if (!rolando || bacBo) return;
    const relogio = setInterval(() => setQuadro((n) => (n % 6) + 1), QUADRO_EM_MS);
    return () => clearInterval(relogio);
  }, [rolando, bacBo]);

  useEffect(() => {
    if (rolando) {
      assentar.value = 0;
      salto.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      giro.value = withRepeat(withTiming(giro.value + 360, { duration: 460, easing: Easing.linear }), -1, false);
      return;
    }

    if (face === null) return;

    cancelAnimation(salto);
    cancelAnimation(giro);
    salto.value = withDelay(
      indice * ATRASO_POR_DADO,
      // Sobe uma última vez e cai: é a queda que faz o dado ter peso.
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.bounce }),
      ),
    );
    // Para num múltiplo de 360 pra a face acabar de pé, e não torta.
    giro.value = withDelay(
      indice * ATRASO_POR_DADO,
      withTiming(Math.ceil(giro.value / 360) * 360, { duration: 370, easing: Easing.out(Easing.cubic) }),
    );
    assentar.value = withDelay(indice * ATRASO_POR_DADO, withSpring(1, MOLA));
  }, [rolando, face, indice, salto, giro, assentar]);

  const animado = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(salto.value, [0, 1], [0, -tamanho * 0.42]) },
      { rotate: `${giro.value}deg` },
      { scale: interpolate(assentar.value, [0, 1], [0.92, 1]) },
    ],
  }));

  // Rolando: o borrado no Bac Bo, a face da vez nos outros. Parado: a face sorteada.
  const imagem = rolando
    ? bacBo
      ? BACBO_DIE_BLURRED
      : faces[quadro]
    : faces[face ?? 1];

  return (
    <Animated.View style={[{ width: tamanho, height: tamanho }, animado]}>
      <Image source={imagem} style={styles.face} resizeMode="contain" />
    </Animated.View>
  );
}

/** O lugar vazio do dado, antes da primeira rodada. */
export function DadoVazio({ tamanho = 56 }: { tamanho?: number }) {
  return <View style={[styles.vazio, { width: tamanho, height: tamanho, borderRadius: tamanho * 0.18 }]} />;
}

const styles = StyleSheet.create({
  face: { width: '100%', height: '100%' },
  vazio: {
    borderWidth: 1,
    borderColor: 'rgba(229,181,103,0.28)',
    backgroundColor: 'rgba(11,15,13,0.45)',
  },
});
