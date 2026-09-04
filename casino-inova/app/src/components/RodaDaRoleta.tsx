import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme';

/**
 * A ordem física das casas na roda, no sentido horário a partir do zero.
 *
 * É a sequência da roleta europeia de zero único, e foi lida da própria arte
 * (assets/images/roleta/roda-roleta.png), onde o zero está às 12 horas. Mudar a arte
 * sem mudar esta lista faz a bola parar na casa errada — o número mostrado continuaria
 * certo, mas a roda estaria mentindo, que é pior do que não ter animação.
 *
 * O servidor não conhece esta lista: lá o sorteio é um número de 0 a 36, uniforme. A
 * ordem aqui é só desenho.
 */
export const CASAS_DA_RODA = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const GRAUS_POR_CASA = 360 / CASAS_DA_RODA.length;

/** Voltas inteiras antes de assentar. Quatro é o que dá tempo de ver a roda correndo. */
const VOLTAS = 4;

const DURACAO_DA_PARADA = 3200;

/*
 * ONDE A BOLA CORRE E ONDE ELA CAI, medido na própria arte da roda
 * (assets/images/roleta/roda-roleta.png, 2048x2048).
 *
 * Varrendo a imagem em anéis, as casas pintadas de vermelho e preto ocupam de 0,464 a
 * 0,714 do raio, e a pista de madeira escura em volta vai de 0,75 a 0,89. São dois
 * lugares diferentes, e a bola passa pelos dois: enquanto corre ela fica na pista de
 * fora; quando a roda perde velocidade ela cai pra dentro e assenta na casa.
 *
 * Os números estão em fração do TAMANHO da roda (o dobro do raio), que é o que o
 * componente recebe: 0,385 é o meio da pista, 0,295 é o meio das casas.
 */
const RAIO_DA_PISTA = 0.385;
const RAIO_DA_CASA = 0.295;

interface RodaProps {
  /** O número que o servidor sorteou, ou null enquanto não há resultado. */
  resultado: number | null;
  girando: boolean;
  tamanho: number;
}

/**
 * A roda da roleta: gira, e a bola para na casa que o servidor sorteou.
 *
 * A roda e a bola giram em sentidos opostos, como na mesa de verdade. Quando o
 * resultado chega, a roda desacelera até deixar a casa sorteada embaixo do marcador do
 * topo, e a bola assenta ali.
 *
 * Como no caça-níqueis, a animação não decide nada: o número já veio do servidor antes
 * de a roda começar a parar. O desenho só conta o que já aconteceu.
 */
export function RodaDaRoleta({ resultado, girando, tamanho }: RodaProps) {
  const anguloDaRoda = useSharedValue(0);
  const anguloDaBola = useSharedValue(0);
  /** A que distância do centro a bola está. Ela CAI pra dentro quando a roda para. */
  const raioDaBola = useSharedValue(RAIO_DA_PISTA);

  useEffect(() => {
    if (girando) {
      anguloDaRoda.value = withRepeat(
        withTiming(anguloDaRoda.value + 360, { duration: 1100, easing: Easing.linear }),
        -1,
        false,
      );
      // Sentido contrário e mais rápida, que é como a bola corre na pista de cima.
      anguloDaBola.value = withRepeat(
        withTiming(anguloDaBola.value - 360, { duration: 620, easing: Easing.linear }),
        -1,
        false,
      );
      // Correndo, ela fica na pista de fora — é lá que a bola anda antes de cair.
      raioDaBola.value = withTiming(RAIO_DA_PISTA, { duration: 300 });
      return;
    }

    if (resultado === null) return;

    const casa = CASAS_DA_RODA.indexOf(resultado);
    if (casa < 0) return;

    cancelAnimation(anguloDaRoda);
    cancelAnimation(anguloDaBola);
    cancelAnimation(raioDaBola);

    /*
     * Onde a roda tem que parar: girar a casa sorteada até o marcador das 12 horas.
     * A conta parte do ângulo atual pra a roda não dar um salto ao trocar de animação —
     * ela continua de onde estava e só acrescenta as voltas que faltam.
     */
    const atual = anguloDaRoda.value;
    const destino = -casa * GRAUS_POR_CASA;
    const voltasInteiras = Math.ceil((atual + VOLTAS * 360 - destino) / 360) * 360;

    anguloDaRoda.value = withTiming(destino + voltasInteiras, {
      duration: DURACAO_DA_PARADA,
      // Desacelera muito no fim: é o que faz a roda parecer pesada.
      easing: Easing.out(Easing.poly(4)),
    });
    // A bola assenta no topo, junto com a casa.
    anguloDaBola.value = withTiming(Math.floor(anguloDaBola.value / 360) * 360, {
      duration: DURACAO_DA_PARADA,
      easing: Easing.out(Easing.poly(4)),
    });
    /*
     * E cai pra dentro no fim, não no começo: a bola desliza na pista enquanto tem
     * velocidade e só desce pra casa quando a roda já está lenta. `Easing.in` deixa a
     * queda quase toda no último terço da parada, que é quando ela acontece na mesa.
     */
    raioDaBola.value = withTiming(RAIO_DA_CASA, {
      duration: DURACAO_DA_PARADA,
      easing: Easing.in(Easing.poly(3)),
    });
  }, [girando, resultado, anguloDaRoda, anguloDaBola, raioDaBola]);

  const roda = useAnimatedStyle(() => ({ transform: [{ rotate: `${anguloDaRoda.value}deg` }] }));
  const bola = useAnimatedStyle(() => ({ transform: [{ rotate: `${anguloDaBola.value}deg` }] }));
  /* O raio muda enquanto ela cai, então o deslocamento é animado junto com o giro. */
  const posicaoDaBola = useAnimatedStyle(() => ({
    transform: [{ translateY: -raioDaBola.value * tamanho }],
  }));

  const ladoDaBola = Math.max(9, Math.round(tamanho * 0.045));

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Animated.View style={[styles.camada, roda]}>
        <Image
          source={require('../../assets/images/roleta/roda-roleta.png')}
          style={{ width: tamanho, height: tamanho }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* A bola mora numa camada própria, que gira sozinha em volta do mesmo centro. */}
      <Animated.View style={[styles.camada, bola]} pointerEvents="none">
        <Animated.View
          style={[
            styles.bola,
            { width: ladoDaBola, height: ladoDaBola, borderRadius: ladoDaBola / 2 },
            posicaoDaBola,
          ]}
        />
      </Animated.View>

      {/* O marcador fixo das 12 horas: é ele que diz qual casa "venceu". */}
      <View pointerEvents="none" style={styles.marcador} />
    </View>
  );
}

const styles = StyleSheet.create({
  camada: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bola: {
    backgroundColor: '#F7F3E8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  marcador: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.goldBright,
  },
});
