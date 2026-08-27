import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CARD_BACK_IMAGE, CARD_IMAGES, TRUCO_CARD_IMAGES } from '../data/gameAssets';
import { CURVA, MOLA, TEMPO } from '../animation';
import { colors, radius } from '../theme';

interface CartaProps {
  /** 'copas-A', 'espadas-10'… ou null pra carta virada pra baixo. */
  carta: string | null;
  /** Posição na mão — dá o atraso da distribuição, uma carta depois da outra. */
  indice?: number;
  largura?: number;
  /** Usa o baralho do truco (o mesmo desenho, só 40 cartas). */
  truco?: boolean;
}

/** Proporção de carta de baralho. As imagens são 500x750. */
const PROPORCAO = 1.5;

/** Quanto tempo entre uma carta e a próxima da mesma mão. */
const ATRASO_ENTRE_CARTAS = 110;

/**
 * Uma carta na mesa.
 *
 * Faz duas coisas que carta de verdade faz: chega deslizando do monte, uma depois da
 * outra, e vira quando é revelada. A virada é uma rotação no eixo Y com o verso e a
 * frente ocupando o mesmo lugar — a metade de trás fica escondida, então o que se vê é
 * a carta girando, e não duas imagens trocando.
 *
 * A carta virada pra baixo (`carta === null`) é a do dealer que ainda não abriu. Quando
 * o servidor manda o valor, ela vira ali mesmo, sem sumir e voltar.
 */
export function Carta({ carta, indice = 0, largura = 62, truco = false }: CartaProps) {
  const altura = Math.round(largura * PROPORCAO);
  const baralho = truco ? TRUCO_CARD_IMAGES : CARD_IMAGES;
  const frente = carta ? baralho[carta] : undefined;

  const chegada = useSharedValue(0);
  const viragem = useSharedValue(carta ? 1 : 0);

  // Distribuição: entra deslizando de cima, com uma inclinação que se desfaz.
  useEffect(() => {
    chegada.value = withDelay(indice * ATRASO_ENTRE_CARTAS, withSpring(1, MOLA));
  }, [chegada, indice]);

  // Viragem: só acontece quando a carta ganha valor.
  useEffect(() => {
    viragem.value = withTiming(carta ? 1 : 0, { duration: TEMPO.entrada, easing: CURVA.suave });
  }, [carta, viragem]);

  const entrada = useAnimatedStyle(() => ({
    opacity: chegada.value,
    transform: [
      { translateY: interpolate(chegada.value, [0, 1], [-34, 0]) },
      { translateX: interpolate(chegada.value, [0, 1], [26, 0]) },
      { rotate: `${interpolate(chegada.value, [0, 1], [12, 0])}deg` },
    ],
  }));

  /*
   * As duas faces giram juntas, meia volta uma da outra. `backfaceVisibility` esconde a
   * que está de costas — sem isso as duas apareceriam espelhadas ao mesmo tempo.
   */
  const ladoDaFrente = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${interpolate(viragem.value, [0, 1], [180, 360])}deg` }],
  }));
  const ladoDeTras = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${interpolate(viragem.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={[{ width: largura, height: altura }, entrada]}>
      <Animated.View style={[styles.face, styles.moldura, ladoDeTras]}>
        <Image source={CARD_BACK_IMAGE} style={styles.imagem} resizeMode="cover" />
      </Animated.View>

      <Animated.View style={[styles.face, styles.moldura, ladoDaFrente]}>
        {frente && <Image source={frente} style={styles.imagem} resizeMode="contain" />}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
  moldura: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  imagem: { width: '100%', height: '100%' },
});
