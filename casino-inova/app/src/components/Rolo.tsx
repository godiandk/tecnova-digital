import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IDS_DOS_SIMBOLOS, SLOT_SYMBOLS } from '../data/slotSymbols';

interface RoloProps {
  /** Os símbolos que o servidor sorteou pra esta coluna, de cima pra baixo. */
  resultado: string[] | null;
  /** Ligado enquanto o giro está em andamento. */
  girando: boolean;
  /** Índice do rolo, da esquerda pra direita — define quanto ele demora a mais pra parar. */
  coluna: number;
  /** Quantos símbolos aparecem na janela. Vem do servidor junto com a grade. */
  fileiras?: number;
  altura: number;
  largura: number;
}

/** Símbolos de ruído acima do resultado. Quanto mais, mais longa parece a corrida. */
const RUIDO = 12;

/** Quanto tempo uma volta inteira do ruído leva. Curto: rolo de verdade é rápido. */
const VOLTA_EM_MS = 260;

/** Cada rolo para 260 ms depois do anterior, da esquerda pra direita — o "tec, tec, tec". */
const ATRASO_POR_COLUNA = 260;

/**
 * Uma coluna do caça-níqueis.
 *
 * O rolo é uma tira vertical de símbolos que desliza. Enquanto o giro está em
 * andamento a tira roda em laço sobre o ruído; quando o resultado chega, ela corre até
 * o fim da tira, onde estão os símbolos que o servidor sorteou, e para com um
 * repique curto — o mesmo baque que um rolo mecânico dá ao travar.
 *
 * Vale dizer o que esta animação NÃO faz: ela não escolhe nada. Os símbolos já vieram
 * decididos do servidor antes de o rolo começar a desacelerar, e o desenho aqui só
 * mostra o que já aconteceu. Não existe parada "quase no prêmio" combinada — a taxa de
 * retorno é a publicada, e é sorteio de verdade.
 */
export function Rolo({ resultado, girando, coluna, fileiras = 3, altura, largura }: RoloProps) {
  const deslocamento = useSharedValue(0);
  const [ruido] = useState(() => sortearRuido(RUIDO));

  /*
   * A tira só é remontada quando o resultado muda. Sem o useMemo, cada quadro da
   * animação sorteava um ruído novo e a coluna piscava em vez de rolar.
   */
  const tira = useMemo(
    () => [...ruido, ...(resultado ?? sortearRuido(fileiras))],
    [ruido, resultado, fileiras],
  );

  const fim = -(RUIDO * altura);

  useEffect(() => {
    if (girando) {
      // Laço sobre o ruído: sobe uma tela de símbolos e volta, sem parar.
      deslocamento.value = 0;
      deslocamento.value = withRepeat(
        withTiming(-(fileiras * altura), { duration: VOLTA_EM_MS, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }

    if (!resultado) return;

    cancelAnimation(deslocamento);
    // Volta pro topo pra a corrida final ter distância pra desacelerar.
    deslocamento.value = 0;
    deslocamento.value = withDelay(
      coluna * ATRASO_POR_COLUNA,
      withSequence(
        withTiming(fim, { duration: 620, easing: Easing.out(Easing.cubic) }),
        // O repique: passa 8px e volta. É o que faz o rolo parecer ter peso.
        withTiming(fim + 8, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(fim, { duration: 110, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [girando, resultado, altura, coluna, fileiras, fim, deslocamento]);

  const animado = useAnimatedStyle(() => ({ transform: [{ translateY: deslocamento.value }] }));

  return (
    <View style={[styles.janela, { width: largura, height: altura * fileiras }]}>
      <Animated.View style={animado}>
        {tira.map((simbolo, indice) => (
          <View key={`${indice}-${simbolo}`} style={{ width: largura, height: altura }}>
            <Image source={SLOT_SYMBOLS[simbolo]} style={styles.simbolo} resizeMode="contain" />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function sortearRuido(quantos: number): string[] {
  return Array.from(
    { length: quantos },
    () => IDS_DOS_SIMBOLOS[Math.floor(Math.random() * IDS_DOS_SIMBOLOS.length)],
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` é o que transforma a tira num rolo: só a janela de símbolos aparece.
  janela: { overflow: 'hidden' },
  simbolo: { width: '86%', height: '86%', alignSelf: 'center', marginTop: '7%' },
});
