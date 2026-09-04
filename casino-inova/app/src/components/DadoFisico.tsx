import { useEffect, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Quadro, QUADROS_POR_SEGUNDO } from '../fisica/motorDeDados';

/**
 * Um dado percorrendo o caminho que a física calculou.
 *
 * O CAMINHO JÁ VEM PRONTO. O motor (`fisica/motorDeDados.ts`) simula o lançamento
 * inteiro antes de qualquer pixel se mexer e devolve uma lista de quadros. Aqui só se
 * anda por essa lista. Duas coisas vêm disso:
 *
 * - O desenho roda no processador de animação do aparelho, sem depender de o JavaScript
 *   conseguir acompanhar 60 vezes por segundo. Num celular ocupado, o dado não engasga.
 * - O mesmo lançamento fica idêntico em qualquer aparelho, do mais rápido ao mais lento.
 *
 * COMO O CUBO É MOSTRADO SEM SER UM CUBO. Empilhar seis faces em 3D de verdade exigiria
 * `translateZ`, que existe no navegador e NÃO existe no React Native — o cubo ficaria
 * bonito na web e achatado no celular. Em vez de duas implementações que divergem, o
 * dado é desenhado do jeito que a câmera enxergaria:
 *
 * 1. A FACE VIRADA PRA FRENTE é calculada da orientação, quadro a quadro. Ela troca
 *    exatamente quando trocaria num cubo de verdade: aos 45 graus de giro, quando a
 *    face vizinha passa a estar mais de frente.
 * 2. O ENCURTAMENTO. Uma face girada não some de repente: ela fica mais estreita, como
 *    fica qualquer coisa vista de lado. `escalaX` é o cosseno do giro em pé e `escalaY`
 *    o do giro deitado — nos 45 graus dá 0,707, que é a maior compressão possível antes
 *    de a face vizinha assumir. É a mesma conta que um cubo de verdade obedece.
 * 3. A ALTURA vira tamanho e sombra. Dado no alto é maior e a sombra dele é pequena,
 *    escura e longe; dado no feltro é menor e a sombra encosta nele. É o que faz o
 *    quique ser visto como quique e não como o dado escorregando pro lado.
 */

export interface DadoFisicoProps {
  /** O caminho calculado pelo motor, do lançamento até parar. */
  caminho: Quadro[];
  /** As seis faces, na ordem 1 a 6. */
  faces: ImageSourcePropType[];
  /** Lado do dado em pixels, quando pousado. */
  tamanho: number;
  /** Quantos pixels vale uma unidade do motor (o motor mede em meio dado). */
  escalaDoMundo: number;
  /** Onde fica o centro da arena, em pixels, dentro do pai. */
  centro: { x: number; y: number };
  /** Reinicia a animação quando muda. Use o número do lançamento. */
  chave: number;
}

/** Altura em que o dado aparenta o dobro do tamanho. Só perspectiva, não é física. */
const ALTURA_DE_REFERENCIA = 14;

export function DadoFisico({ caminho, faces, tamanho, escalaDoMundo, centro, chave }: DadoFisicoProps) {
  const andar = useSharedValue(0);
  const quadros = caminho.length;

  useEffect(() => {
    if (quadros === 0) return;
    andar.value = 0;
    andar.value = withTiming(1, {
      duration: (quadros / QUADROS_POR_SEGUNDO) * 1000,
      // Linear de propósito: a desaceleração já está na física. Suavizar por cima
      // desmentiria o quique — o dado pareceria frear no ar.
      easing: Easing.linear,
    });
  }, [chave, quadros, andar]);

  /*
   * Os números crus vão pro processador de animação. Passar objetos ricos custaria uma
   * cópia por quadro; seis vetores de número são copiados uma vez e lidos lá dentro.
   */
  const trilha = useMemo(
    () => ({
      x: caminho.map((q) => q.x),
      y: caminho.map((q) => q.y),
      z: caminho.map((q) => q.z),
      rx: caminho.map((q) => q.rx),
      ry: caminho.map((q) => q.ry),
      rz: caminho.map((q) => q.rz),
    }),
    [caminho],
  );

  const estiloDoDado = useAnimatedStyle(() => {
    'worklet';
    if (quadros === 0) return { opacity: 0 };
    const i = Math.min(quadros - 1, Math.max(0, Math.floor(andar.value * quadros)));

    const alturaRelativa = trilha.z[i] / ALTURA_DE_REFERENCIA;
    const perspectiva = 1 + alturaRelativa * 0.55;

    // O encurtamento: a face vira de lado e estreita, como estreitaria de verdade.
    const grau = Math.PI / 180;
    const restoX = (((trilha.rx[i] + 45) % 90) + 90) % 90 - 45;
    const restoY = (((trilha.ry[i] + 45) % 90) + 90) % 90 - 45;
    const escalaX = Math.cos(restoY * grau);
    const escalaY = Math.cos(restoX * grau);

    return {
      transform: [
        { translateX: centro.x + trilha.x[i] * escalaDoMundo },
        { translateY: centro.y + trilha.y[i] * escalaDoMundo - trilha.z[i] * escalaDoMundo * 0.55 },
        { rotate: `${trilha.rz[i]}deg` },
        { scaleX: escalaX * perspectiva },
        { scaleY: escalaY * perspectiva },
      ],
    };
  }, [quadros, escalaDoMundo, centro.x, centro.y]);

  const estiloDaSombra = useAnimatedStyle(() => {
    'worklet';
    if (quadros === 0) return { opacity: 0 };
    const i = Math.min(quadros - 1, Math.max(0, Math.floor(andar.value * quadros)));
    const alturaRelativa = Math.min(1, trilha.z[i] / ALTURA_DE_REFERENCIA);
    return {
      opacity: 0.42 * (1 - alturaRelativa * 0.75),
      transform: [
        { translateX: centro.x + trilha.x[i] * escalaDoMundo },
        { translateY: centro.y + trilha.y[i] * escalaDoMundo + tamanho * 0.16 },
        { scale: 1 - alturaRelativa * 0.45 },
      ],
    };
  }, [quadros, escalaDoMundo, centro.x, centro.y, tamanho]);

  /*
   * Qual face está de frente AGORA, num valor só, calculado uma vez por quadro.
   *
   * Cada face lê este número em vez de refazer a conta: seis contas por quadro viraram
   * uma. E, mais importante, isto deixa cada face ter o próprio `useAnimatedStyle`
   * dentro do próprio componente — hook chamado em laço funciona por acaso enquanto a
   * lista tem sempre o mesmo tamanho, e quebra no dia em que não tiver.
   */
  const faceVisivel = useDerivedValue(() => {
    'worklet';
    if (quadros === 0) return 1;
    const i = Math.min(quadros - 1, Math.max(0, Math.floor(andar.value * quadros)));
    return faceNaFrente(trilha.rx[i], trilha.ry[i]);
  }, [quadros]);

  const meio = -tamanho / 2;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sombra,
          { width: tamanho * 0.92, height: tamanho * 0.34, borderRadius: tamanho * 0.17, marginLeft: meio * 0.92, marginTop: meio * 0.34 },
          estiloDaSombra,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.dado, { width: tamanho, height: tamanho, marginLeft: meio, marginTop: meio }, estiloDoDado]}
      >
        {faces.map((fonte, indice) => (
          <FaceDoDado key={indice} fonte={fonte} numero={indice + 1} faceVisivel={faceVisivel} />
        ))}
      </Animated.View>
    </>
  );
}

/**
 * Uma das seis faces. Fica montada o tempo todo e só aparece quando é a da frente.
 *
 * Montar e desmontar a imagem a cada troca faria o dado piscar branco no primeiro quadro
 * de cada face nova, porque a imagem só desenha depois de carregada. Seis imagens
 * paradas não custam nada; o piscar apareceria em toda rolagem.
 */
function FaceDoDado({
  fonte,
  numero,
  faceVisivel,
}: {
  fonte: ImageSourcePropType;
  numero: number;
  faceVisivel: SharedValue<number>;
}) {
  const estilo = useAnimatedStyle(() => {
    'worklet';
    return { opacity: faceVisivel.value === numero ? 1 : 0 };
  }, [numero]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilo]}>
      <Image source={fonte} style={styles.face} resizeMode="contain" />
    </Animated.View>
  );
}

/**
 * Qual face está virada pra frente, nesta orientação.
 *
 * É a mesma conta de `faceVirada` no motor, reescrita como worklet porque roda no
 * processador de animação, onde não dá pra chamar função de fora. A verificação do motor
 * confere a versão de lá; se as duas divergirem, o dado mostra uma face e o servidor
 * pagou outra — por isso a tabela de faces é a mesma, escrita igual, e as duas são
 * conferidas contra as mesmas seis orientações.
 */
function faceNaFrente(rx: number, ry: number): number {
  'worklet';
  const grau = Math.PI / 180;
  const sx = Math.sin(rx * grau);
  const cx = Math.cos(rx * grau);
  const sy = Math.sin(ry * grau);
  const cy = Math.cos(ry * grau);

  const normais: number[][] = [
    [1, 0, 0, 1],
    [6, 0, 0, -1],
    [2, 1, 0, 0],
    [5, -1, 0, 0],
    [3, 0, -1, 0],
    [4, 0, 1, 0],
  ];

  let melhor = 1;
  let maiorZ = -2;
  for (let k = 0; k < normais.length; k += 1) {
    const face = normais[k][0];
    const x = normais[k][1];
    const y = normais[k][2];
    const z = normais[k][3];
    const z1 = y * sx + z * cx;
    const z2 = -x * sy + z1 * cy;
    if (z2 > maiorZ) {
      maiorZ = z2;
      melhor = face;
    }
  }
  return melhor;
}

const styles = StyleSheet.create({
  dado: { position: 'absolute', top: 0, left: 0 },
  sombra: { position: 'absolute', top: 0, left: 0, backgroundColor: '#000' },
  face: { width: '100%', height: '100%' },
});
