import { useEffect, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { faceVirada, Quadro, QUADROS_POR_SEGUNDO } from '../fisica/motorDeDados';

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
    /*
     * `trilha` PRECISA ESTAR AQUI. Ela é lida dentro do worklet, e sem entrar na lista
     * o worklet fica com a trilha do lançamento anterior — o dado repetiria o mesmo
     * caminho a cada rodada, porque no Bac Bo e na Banca Francesa todo lançamento tem o
     * mesmo número de quadros e `quadros` sozinho nunca muda.
     */
  }, [quadros, escalaDoMundo, centro.x, centro.y, trilha]);

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
  }, [quadros, escalaDoMundo, centro.x, centro.y, tamanho, trilha]);

  /*
   * QUAL FACE ESTÁ DE FRENTE EM CADA QUADRO — calculado UMA VEZ, em JavaScript comum.
   *
   * Antes isto era um worklet que refazia a conta a cada quadro, no processador de
   * animação. Duas coisas ruins vinham daí, e as duas apareceram na tela:
   *
   * 1. A CONTA ESTAVA DUPLICADA. O motor tem `faceVirada`, e o worklet tinha uma cópia
   *    dela reescrita — com o aviso, no próprio comentário, de que se as duas
   *    divergissem o dado mostraria uma face e o servidor pagaria outra. Agora existe
   *    uma só, a do motor, e é a mesma que a verificação confere.
   *
   * 2. O WORKLET GUARDAVA O CAMINHO ANTIGO. A lista de dependências era `[quadros]`, e
   *    no Bac Bo todos os lançamentos têm o MESMO número de quadros (o motor iguala os
   *    quatro dados). Quadros iguais, dependência igual, worklet não reconstruído: ele
   *    continuava lendo as rotações do primeiro lançamento da sessão para sempre. Era
   *    isto que fazia os quatro dados assentarem mostrando a mesma face enquanto o texto
   *    embaixo dizia outro resultado.
   *
   * Uma lista de números inteiros, calculada quando o caminho muda, não tem nem uma
   * coisa nem a outra: é o mesmo dado que o motor já entregou, lido do jeito mais
   * simples possível.
   */
  const facePorQuadro = useMemo(() => caminho.map((q) => faceVirada(q.rx, q.ry)), [caminho]);

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
          <FaceDoDado
            key={indice}
            fonte={fonte}
            numero={indice + 1}
            facePorQuadro={facePorQuadro}
            andar={andar}
          />
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
  facePorQuadro,
  andar,
}: {
  fonte: ImageSourcePropType;
  numero: number;
  /** Que face está de frente em cada quadro do caminho. Vem pronta do motor. */
  facePorQuadro: number[];
  /** Onde a animação está, de 0 a 1. */
  andar: SharedValue<number>;
}) {
  const estilo = useAnimatedStyle(() => {
    'worklet';
    const total = facePorQuadro.length;
    if (total === 0) return { opacity: 0 };
    const i = Math.min(total - 1, Math.max(0, Math.floor(andar.value * total)));
    return { opacity: facePorQuadro[i] === numero ? 1 : 0 };
    /*
     * `facePorQuadro` ENTRA NA LISTA DE DEPENDÊNCIAS. Sem ela, o worklet guardaria a
     * lista do lançamento anterior — que é exatamente o defeito que esta versão
     * conserta, só que um andar acima.
     */
  }, [numero, facePorQuadro]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilo]}>
      <Image source={fonte} style={styles.face} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dado: { position: 'absolute', top: 0, left: 0 },
  sombra: { position: 'absolute', top: 0, left: 0, backgroundColor: '#000' },
  face: { width: '100%', height: '100%' },
});
