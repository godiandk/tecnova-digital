import { useEffect, useMemo, useState } from 'react';
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
  withTiming,
} from 'react-native-reanimated';

import { BACBO_DIE_BLURRED, BACBO_DIE_IMAGES, DIE_FACE_IMAGES } from '../data/gameAssets';
import { lancar } from '../animation/fisica';

interface DadoProps {
  /** A face que o servidor sorteou, ou null enquanto ainda está rolando. */
  face: number | null;
  rolando: boolean;
  /** Posição na mesa — cada dado é lançado um pouco depois do anterior. */
  indice?: number;
  tamanho?: number;
  /** O dado do Bac Bo tem arte própria; os outros usam o dado da marca. */
  bacBo?: boolean;
  /**
   * O dado está preso num agitador de vidro e nunca é lançado no pano — ele chacoalha
   * no lugar e assenta ali mesmo. Sem isto, o dado entra voando de fora do quadro, que
   * é o certo pra quem joga dado na mesa e o errado pra quem tem o dado num copo.
   */
  noAgitador?: boolean;
}

/** Quanto tempo cada face fica na tela durante o chacoalho. */
const QUADRO_EM_MS = 70;

/** Um dado é lançado depois do outro — é o que dá o "toc, toc" da mão que solta. */
const ATRASO_POR_DADO = 150;

/** Quanto tempo o dado leva do lançamento até parar. */
const VOO_EM_MS = 1150;

/**
 * Um dado em cima da mesa.
 *
 * Enquanto a rodada não fecha, ele chacoalha no lugar — é a mão segurando. Quando o
 * resultado chega, ele é LANÇADO: entra vindo de fora do quadro, cruza o pano girando,
 * quica três vezes com saltos cada vez menores e para na face sorteada. A sombra
 * embaixo encolhe e escurece conforme ele desce, que é o que dá a altura.
 *
 * O Bac Bo tem um quadro borrado próprio na arte, e é ele que aparece no chacoalho: o
 * dado lê como objeto girando rápido demais pro olho acompanhar, em vez de seis
 * desenhos piscando.
 *
 * Como no rolo e na roleta, a animação não decide nada: a face já veio do servidor
 * antes de o dado começar a desacelerar. O caminho é desenho; o resultado é sorteio.
 */
export function Dado({ face, rolando, indice = 0, tamanho = 56, bacBo = false, noAgitador = false }: DadoProps) {
  const faces = bacBo ? BACBO_DIE_IMAGES : DIE_FACE_IMAGES;
  /*
   * Começa POUSADO, sempre. `voo = 0` é o ponto de LANÇAMENTO — fora do quadro, alto e
   * de lado. Um dado que nasce em 0 e nunca é lançado fica boiando no ar acima do lugar
   * dele, que foi exatamente o que aconteceu nos agitadores do Bac Bo antes da primeira
   * rodada. Quem monta já com uma face (uma reconexão, por exemplo) também tem que
   * aparecer pousado.
   */
  const voo = useSharedValue(1);
  const chacoalho = useSharedValue(0);
  const [quadro, setQuadro] = useState(1);

  /*
   * De onde o dado entra: de cima, como se caísse do agitador, com um desvio lateral
   * pequeno pra os dois não descerem em bloco.
   *
   * A distância é curta de propósito. Numa versão anterior o dado partia de três vezes
   * o próprio tamanho e sumia do quadro no primeiro terço do voo — em vez de "entrando
   * na mesa", lia como "desapareceu e voltou".
   */
  const caminho = useMemo(
    () =>
      lancar({
        deX: tamanho * (indice % 2 === 0 ? -0.55 : 0.7),
        deY: -tamanho * 1.5,
        giros: 2.5 + indice * 0.4,
        alturaInicial: 0.8,
      }),
    [tamanho, indice],
  );

  // Chacoalho: troca de face depressa. Só serve pro dado sem quadro borrado.
  useEffect(() => {
    if (!rolando || bacBo) return;
    const relogio = setInterval(() => setQuadro((n) => (n % 6) + 1), QUADRO_EM_MS);
    return () => clearInterval(relogio);
  }, [rolando, bacBo]);

  useEffect(() => {
    if (rolando) {
      // No agitador o dado não sai do lugar: só o chacoalho se mexe.
      voo.value = noAgitador ? 1 : 0;
      chacoalho.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 110, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      return;
    }

    if (face === null) return;

    cancelAnimation(chacoalho);

    if (noAgitador) {
      /*
       * Os agitadores param um depois do outro, da esquerda pra direita — é o mesmo
       * atraso do lançamento, só que aqui ele vira o "toc, toc, toc" de cada copo
       * assentando. O dado já está no lugar; o que termina é o chacoalho.
       */
      voo.value = 1;
      chacoalho.value = withDelay(
        indice * ATRASO_POR_DADO,
        withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
      );
      return;
    }

    chacoalho.value = 0;
    voo.value = 0;
    voo.value = withDelay(
      indice * ATRASO_POR_DADO,
      withTiming(1, { duration: VOO_EM_MS, easing: Easing.linear }),
    );
  }, [rolando, face, indice, noAgitador, voo, chacoalho]);

  const dado = useAnimatedStyle(() => {
    const t = voo.value;
    const x = interpolate(t, caminho.tempos, caminho.x);
    const y = interpolate(t, caminho.tempos, caminho.y);
    const altura = interpolate(t, caminho.tempos, caminho.altura);
    const giro = interpolate(t, caminho.tempos, caminho.giro);
    // Chacoalho na mão: um pulinho curto, sem sair do lugar.
    const pulo = interpolate(chacoalho.value, [0, 1], [0, -tamanho * 0.18]);
    return {
      transform: [
        { translateX: x },
        { translateY: y + pulo - altura * tamanho * 1.15 },
        // Mais alto = mais perto de quem olha, então um pouco maior.
        { scale: 1 + altura * 0.28 },
        { rotate: `${giro + chacoalho.value * 14}deg` },
      ],
    };
  });

  /*
   * A sombra é o que prova que o dado está no ar: ela fica no chão, não sobe junto, e
   * some conforme ele se afasta do pano. Sem ela o salto lê como "cresceu", não "subiu".
   */
  const sombra = useAnimatedStyle(() => {
    const t = voo.value;
    const x = interpolate(t, caminho.tempos, caminho.x);
    const y = interpolate(t, caminho.tempos, caminho.y);
    const altura = interpolate(t, caminho.tempos, caminho.altura);
    return {
      opacity: 0.5 - altura * 0.42,
      transform: [
        { translateX: x },
        { translateY: y + tamanho * 0.42 },
        { scaleX: 1 - altura * 0.45 },
        { scaleY: 0.32 - altura * 0.12 },
      ],
    };
  });

  // Rolando: o borrado no Bac Bo, a face da vez nos outros. Parado: a face sorteada.
  const imagem = rolando ? (bacBo ? BACBO_DIE_BLURRED : faces[quadro]) : faces[face ?? 1];

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.sombra, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }, sombra]}
      />
      <Animated.View style={[styles.dado, { width: tamanho, height: tamanho }, dado]}>
        <Image source={imagem} style={styles.face} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/** O lugar vazio do dado, antes da primeira rodada. */
export function DadoVazio({ tamanho = 56 }: { tamanho?: number }) {
  return <View style={[styles.vazio, { width: tamanho, height: tamanho, borderRadius: tamanho * 0.18 }]} />;
}

const styles = StyleSheet.create({
  dado: { position: 'absolute', top: 0, left: 0 },
  sombra: { position: 'absolute', top: 0, left: 0, backgroundColor: '#000' },
  face: { width: '100%', height: '100%' },
  vazio: {
    borderWidth: 1,
    borderColor: 'rgba(229,181,103,0.28)',
    backgroundColor: 'rgba(11,15,13,0.45)',
  },
});
