import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { LOBBY_UI } from '../data/lobbyAssets';
import { CURVA, TEMPO } from '../animation';
import { colors, fontFamily } from '../theme';

interface LevelBarProps {
  level: number;
  xp: number;
  xpToNextLevel: number;
  width: number;
  /** O XP escrito dentro do canal. Ligado por padrão — era o que faltava aparecer. */
  mostrarXp?: boolean;
}

/** A calha é 800x120. */
const PROPORCAO = 120 / 800;

/**
 * Centro do brasão redondo na ponta esquerda da calha, em fração da imagem.
 *
 * MEDIDO NA ARTE, e desta vez de um jeito que dá pra repetir: o vão escuro do brasão é
 * o segundo maior grupo de pixels escuros de hud-barra-nivel.png (o maior é o canal), e
 * ele vai de x=20 a x=82 e de y=21 a y=83. Centro (51,4; 52,7), diâmetro 63.
 *
 * A conferência está em verificacao/verifica-barra-de-nivel.mjs, que refaz essa medida
 * na imagem e compara com os números daqui. Ela existe porque ESTE MESMO defeito foi
 * relatado três vezes: o número do nível saía encostado na borda direita do vão, meio
 * escondido atrás dos louros, e as duas correções anteriores foram feitas com medidas
 * tomadas à mão que erraram por pouco — a de antes punha o centro em 0,0881 quando ele
 * está em 0,0642, o que numa barra de celular joga o número quase trinta pixels pra
 * direita. É a diferença entre "no meio do brasão" e "grudado no louro".
 */
const BRASAO_X = 0.0642; // 51,4 de 800
const BRASAO_Y = 0.4392; // 52,7 de 120
const BRASAO_TAMANHO = 0.0788; // 63 de 800 — o vão inteiro, sem o anel dourado

/**
 * O CANAL DA CALHA: onde o preenchimento pode aparecer, em fração da imagem.
 *
 * AQUI ESTAVA O DEFEITO QUE SE VIA NA TELA. O corte era feito de x=0 até
 * `largura × progresso`, como se o canal ocupasse a imagem inteira. Ele não ocupa: o
 * canal escuro começa em x=136 (17%) e acaba em x=775 (97%) — antes dele está o brasão,
 * depois dele está a ponta da calha.
 *
 * Duas consequências, as duas visíveis:
 *
 * 1. A ARTE DO PREENCHIMENTO COMEÇA EM x=23, ou seja, ANTES do brasão. Com qualquer XP
 *    acima de 3% a barra dourada era desenhada POR CIMA do brasão, cortando o número do
 *    nível ao meio com um risco de ouro. É o que ele viu e mandou olhar de perto.
 *
 * 2. O progresso não batia com o que se via: os primeiros 17% de XP não mexiam nada
 *    dentro do canal, e a partir de 97% a barra já estava cheia. Ganhar os primeiros
 *    cem XP de um nível não mexia a barra um pixel.
 *
 * Agora o recorte vive DENTRO do canal: começa onde o canal começa, termina onde ele
 * termina, e 0% é canal vazio e 100% é canal cheio.
 */
const CANAL_INICIO = 0.17; // x=136 de 800
const CANAL_FIM = 0.9688; // x=775 de 800

/**
 * A ALTURA DO CANAL, medida na arte: y de 39 a 83, ou seja 45 px de 120 — 38% da imagem.
 *
 * Está aqui por causa de um pedido que esta arte não consegue atender: "barra mais alta".
 * Como a calha é uma imagem de proporção fixa (800x120) com o brasão e os louros
 * desenhados dentro, a única forma de deixá-la mais alta é deixá-la mais LARGA — e numa
 * tela de 390 ela já ocupa quase tudo. Da largura máxima possível ali sobram 56 px de
 * altura total e 21 px de canal, contra os 51 e 19 de hoje: dois pixels.
 *
 * Deformar verticalmente resolveria o número e estragaria o brasão e os louros. Então o
 * que dá pra fazer sem arte nova está feito (o XP passou a caber e a ser legível, a
 * folga em volta aumentou), e um canal de verdade mais alto depende de uma calha
 * desenhada com o canal mais alto. Fica dito com o número, não com "não deu".
 */
const CANAL_TOPO = 39 / 120;   // y=39 de 120
const CANAL_ALTURA = 35 / 120; // y vai de 39 a 73 — 35 px de 120

/**
 * ONDE A FITA DOURADA MORA DENTRO DA ARTE DO PREENCHIMENTO — e por que ela é esticada.
 *
 * Medido na arte, e conferido por `verify:barra-de-nivel`: a fita opaca vai de y=57 a y=69, ou seja **13 px** dentro de um canal de
 * **35 px**. Desenhada no tamanho natural, ela é uma tirinha fina flutuando no meio de
 * uma calha quase três vezes mais alta — e é isso que se vê na tela: a barra parece
 * vazia mesmo cheia, porque o ouro não encosta em cima nem embaixo.
 *
 * A fita é um DEGRADÊ VERTICAL (brilho quase branco em cima, amarelo saturado no meio,
 * âmbar escuro embaixo), sem nenhum detalhe que esticar estrague. Então ela é esticada
 * até cobrir o canal inteiro: o degradê continua sendo degradê, só que numa barra alta.
 * É a única parte desta arte que aceita ser esticada — o brasão e os louros não aceitam,
 * e por isso a calha continua com a proporção original.
 */
const FITA_TOPO = 57 / 120;
const FITA_ALTURA = 13 / 120;

/**
 * Barra de nível. A calha e o preenchimento são duas imagens do mesmo tamanho
 * (800x120) empilhadas: o preenchimento é cortado pela porcentagem de XP, e a calha
 * fica por baixo mostrando o que ainda falta.
 *
 * O número do nível é escrito por cima do brasão — a arte vem vazia de propósito,
 * porque o nível muda.
 */
export function LevelBar({ level, xp, xpToNextLevel, width, mostrarXp = true }: LevelBarProps) {
  const height = Math.round(width * PROPORCAO);
  const progresso = xpToNextLevel > 0 ? Math.max(0, Math.min(1, xp / xpToNextLevel)) : 0;
  const brasao = width * BRASAO_TAMANHO;

  /*
   * O preenchimento cresce até a marca nova em vez de aparecer nela. Ganhar XP passa a
   * ser uma coisa que a pessoa VÊ acontecer — que é o ponto inteiro de existir uma
   * barra de progresso em vez de um número.
   */
  const preenchido = useSharedValue(0);
  const brilhoDoNivel = useSharedValue(0);
  const nivelAnterior = useRef(level);

  useEffect(() => {
    const subiu = level > nivelAnterior.current;
    nivelAnterior.current = level;

    if (!subiu) {
      preenchido.value = withTiming(progresso, { duration: TEMPO.contagem, easing: CURVA.saida });
      return;
    }

    /*
     * SUBIU DE NÍVEL: a barra ENCHE até o fim, e só então recomeça.
     *
     * Sem isso o que se vê é a barra ANDANDO PRA TRÁS — o XP volta pra perto de zero no
     * nível novo, e a animação suave desenha exatamente isso: uma barra que encolhe no
     * momento em que a pessoa foi premiada. Encher, virar e recomeçar conta o que
     * aconteceu, na ordem em que aconteceu.
     */
    preenchido.value = withSequence(
      withTiming(1, { duration: TEMPO.base, easing: CURVA.saida }),
      withTiming(0, { duration: 1 }),
      withDelay(80, withTiming(progresso, { duration: TEMPO.contagem, easing: CURVA.saida })),
    );
    brilhoDoNivel.value = withSequence(
      withTiming(1, { duration: TEMPO.base }),
      withDelay(TEMPO.festa, withTiming(0, { duration: TEMPO.base })),
    );
  }, [progresso, level, preenchido, brilhoDoNivel]);

  /* O canal, em pixels desta barra. É dentro dele que o preenchimento anda. */
  const canalEsquerda = width * CANAL_INICIO;
  const canalLargura = width * (CANAL_FIM - CANAL_INICIO);

  const canalTopo = height * CANAL_TOPO;
  const canalAltura = height * CANAL_ALTURA;

  const animado = useAnimatedStyle(() => ({ width: canalLargura * preenchido.value }));
  /* O brasão pulsa quando o nível vira. Discreto: é comemoração, não fogos. */
  const pulsoDoBrasao = useAnimatedStyle(() => ({ transform: [{ scale: 1 + brilhoDoNivel.value * 0.18 }] }));

  return (
    <View style={{ width, height }} accessibilityLabel={`Nível ${level}, ${xp} de ${xpToNextLevel} XP`}>
      <Image source={LOBBY_UI.barraNivel} style={styles.camada} resizeMode="contain" />

      {/*
        O corte é feito por um contêiner com overflow escondido, POSICIONADO NO CANAL: a
        imagem do preenchimento continua na largura inteira lá dentro, deslocada pra
        esquerda pelo tanto que o canal começa depois da borda. Ela nunca estica nem
        deforma — só aparece o pedaço dela que está dentro do canal.
      */}
      <Animated.View
        style={[styles.recorte, { left: canalEsquerda, top: canalTopo, height: canalAltura }, animado]}
        pointerEvents="none"
      >
        <Image
          source={LOBBY_UI.barraNivelPreenchimento}
          style={{
            width,
            /*
             * A imagem inteira é ampliada até a fita de 13 px valer a altura do canal, e
             * puxada pra cima pelo tanto que a fita começa depois do topo. O recorte
             * acima corta o resto. Resultado: o ouro ocupa o canal de ponta a ponta.
             */
            height: canalAltura / FITA_ALTURA,
            marginLeft: -canalEsquerda,
            marginTop: -(FITA_TOPO / FITA_ALTURA) * canalAltura,
          }}
          resizeMode="stretch"
        />
      </Animated.View>

      {/*
        O XP ESCRITO DENTRO DO CANAL, que é onde ele faz sentido: o número diz o que a
        barra está desenhando. Antes ele não aparecia em lugar nenhum no lobby, e no
        perfil era uma frase solta embaixo — a barra mostrava um progresso que a pessoa
        não conseguia ler.
      */}
      {mostrarXp && xpToNextLevel > 0 && (
        <View
          style={[styles.faixaDoXp, { left: canalEsquerda, width: canalLargura, top: canalTopo, height: canalAltura }]}
          pointerEvents="none"
        >
          <Text
            style={[styles.xp, { fontSize: Math.max(9, Math.round(canalAltura * 0.6)) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {`${xp.toLocaleString('pt-BR')} / ${xpToNextLevel.toLocaleString('pt-BR')} XP`}
          </Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.brasao,
          { left: width * BRASAO_X - brasao / 2, top: height * BRASAO_Y - brasao / 2, width: brasao, height: brasao },
          pulsoDoBrasao,
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.nivel, { fontSize: Math.round(brasao * 0.5) }]} numberOfLines={1} adjustsFontSizeToFit>
          {level}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  camada: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  recorte: { position: 'absolute', overflow: 'hidden' },
  brasao: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  nivel: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
  faixaDoXp: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  /*
   * Sombra escura atrás do texto: ele fica por cima do canal vazio (escuro) E por cima do
   * preenchimento dourado, e precisa ser legível nos dois. Sem a sombra, some no ouro.
   */
  xp: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.textPrimary,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
