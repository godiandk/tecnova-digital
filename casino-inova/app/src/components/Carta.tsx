import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CARD_BACK_IMAGE, CARD_IMAGES, TRUCO_CARD_IMAGES } from '../data/gameAssets';
import { CURVA, TEMPO } from '../animation';
import { lancar } from '../animation/fisica';
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
const ATRASO_ENTRE_CARTAS = 150;

/** Quanto tempo a carta leva do baralho até pousar. */
const VOO_EM_MS = 620;

/**
 * Uma carta em cima da mesa.
 *
 * Ela é DISTRIBUÍDA, não posicionada: sai de fora do quadro, do lado de onde ficaria o
 * baralho, cruza o pano girando, desliza um pouco ao encostar e para no lugar. A sombra
 * embaixo acompanha e some quando ela assenta — é o que faz a carta ter altura em vez
 * de simplesmente aparecer maior.
 *
 * Carta não quica como dado: pousa e escorrega. Por isso um quique só, baixo, e giro
 * bem menor — o exagero aqui lê como papel voando, não como carta dada.
 *
 * A viragem é "levanta, vira, pousa": a carta sobe do pano, estreita até sumir de
 * perfil, e volta a abrir já com a outra face, descendo. Quem vira carta de verdade
 * levanta ela primeiro — girando colada na mesa, o papel atravessa o pano e o efeito
 * denuncia que é desenho.
 *
 * A troca da imagem acontece no meio do giro, quando a carta está de perfil e não dá
 * pra ver qual face é. Uma tentativa anterior usava duas faces sobrepostas com
 * `backfaceVisibility`, e some quando o contêiner também gira: o navegador passa a
 * esconder as DUAS, e a carta virava um retângulo escuro.
 */
export function Carta({ carta, indice = 0, largura = 62, truco = false }: CartaProps) {
  const altura = Math.round(largura * PROPORCAO);
  const baralho = truco ? TRUCO_CARD_IMAGES : CARD_IMAGES;
  const frente = carta ? baralho[carta] : undefined;

  const voo = useSharedValue(0);
  /** 0 = parada; vai até 1 durante uma virada, e volta a 0 no fim. */
  const viragem = useSharedValue(0);
  const [mostrandoFrente, setMostrandoFrente] = useState(Boolean(carta));

  /*
   * O baralho fica acima e à direita da mesa, que é de onde o crupiê distribui. A
   * distância é curta o bastante pra a carta continuar visível o voo inteiro.
   */
  const caminho = useMemo(
    () =>
      lancar({
        deX: largura * 2.4,
        deY: -altura * 1.1,
        giros: 0.75,
        // Carta pousa em pé: o giro tem que fechar uma volta inteira.
        passoDoGiro: 360,
        quantosQuiques: 1,
        alturaInicial: 0.55,
      }),
    [largura, altura],
  );

  useEffect(() => {
    voo.value = 0;
    voo.value = withDelay(
      indice * ATRASO_ENTRE_CARTAS,
      withTiming(1, { duration: VOO_EM_MS, easing: Easing.linear }),
    );
  }, [voo, indice]);

  // Viragem: só acontece quando a carta TROCA de face — não na chegada.
  useEffect(() => {
    const alvo = Boolean(carta);
    if (alvo === mostrandoFrente) return;
    viragem.value = 0;
    viragem.value = withTiming(1, { duration: TEMPO.entrada, easing: CURVA.suave });
    const meio = setTimeout(() => setMostrandoFrente(alvo), TEMPO.entrada / 2);
    return () => clearTimeout(meio);
  }, [carta, mostrandoFrente, viragem]);

  const entrada = useAnimatedStyle(() => {
    const t = voo.value;
    const x = interpolate(t, caminho.tempos, caminho.x);
    const y = interpolate(t, caminho.tempos, caminho.y);
    const alto = interpolate(t, caminho.tempos, caminho.altura);
    const giro = interpolate(t, caminho.tempos, caminho.giro);
    return {
      // Antes de o voo começar (atraso da vez), a carta ainda não existe na mesa.
      opacity: t > 0 ? 1 : 0,
      transform: [
        { translateX: x },
        { translateY: y - alto * altura * 0.5 },
        { scale: 1 + alto * 0.16 },
        { rotate: `${giro}deg` },
      ],
    };
  });

  const sombra = useAnimatedStyle(() => {
    const t = voo.value;
    const x = interpolate(t, caminho.tempos, caminho.x);
    const y = interpolate(t, caminho.tempos, caminho.y);
    const alto = interpolate(t, caminho.tempos, caminho.altura);
    return {
      opacity: t > 0 ? 0.38 - alto * 0.22 : 0,
      transform: [
        { translateX: x + alto * 6 },
        { translateY: y + alto * 8 + altura * 0.06 },
        { scale: 1 - alto * 0.1 },
      ],
    };
  });

  const virada = useAnimatedStyle(() => {
    const v = viragem.value;
    // Meia volta: a largura vai a zero no meio, que é a carta vista de perfil.
    const perfil = Math.abs(Math.cos(Math.PI * v));
    // O quanto ela sobe do pano. É o que impede a carta de atravessar a mesa ao girar.
    const levantada = Math.sin(Math.PI * v);
    return {
      transform: [
        { perspective: 800 },
        { translateY: -levantada * altura * 0.16 },
        { scale: 1 + levantada * 0.08 },
        { scaleX: Math.max(perfil, 0.02) },
      ],
    };
  });

  return (
    <View style={{ width: largura, height: altura }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.sombra, { width: largura, height: altura, borderRadius: radius.sm }, sombra]}
      />
      <Animated.View style={[styles.carta, { width: largura, height: altura }, entrada]}>
        <Animated.View style={[styles.moldura, styles.face, virada]}>
          <Image
            source={mostrandoFrente && frente ? frente : CARD_BACK_IMAGE}
            style={styles.imagem}
            resizeMode={mostrandoFrente && frente ? 'contain' : 'cover'}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  carta: { position: 'absolute', top: 0, left: 0 },
  sombra: { position: 'absolute', top: 0, left: 0, backgroundColor: '#000' },
  face: { ...StyleSheet.absoluteFillObject },
  moldura: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  imagem: { width: '100%', height: '100%' },
});
