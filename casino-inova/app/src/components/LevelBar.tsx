import { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { LOBBY_UI } from '../data/lobbyAssets';
import { CURVA, TEMPO } from '../animation';
import { colors, fontFamily } from '../theme';

interface LevelBarProps {
  level: number;
  xp: number;
  xpToNextLevel: number;
  width: number;
}

/** A calha é 800x120. */
const PROPORCAO = 120 / 800;

/**
 * Centro do brasão redondo na ponta esquerda da calha, em fração da imagem.
 *
 * MEDIDO NA ARTE, não estimado: o anel dourado vai de x=4 a x=139 de 800, e o vão
 * escuro onde o número cabe vai de 31 a 110. Os valores anteriores (0,062 / 0,425 /
 * 0,117) tinham sido chutados olhando a imagem, e o número saía 2% da largura à
 * esquerda do centro do vão — sete pixels numa barra de celular, o bastante pra ler
 * como torto.
 */
const BRASAO_X = 0.0881; // centro do vão: (31+110)/2 de 800
const BRASAO_Y = 0.4125; // centro do vão: (10+89)/2 de 120
const BRASAO_TAMANHO = 0.1; // 80px de 800, o vão inteiro

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
 * Barra de nível. A calha e o preenchimento são duas imagens do mesmo tamanho
 * (800x120) empilhadas: o preenchimento é cortado pela porcentagem de XP, e a calha
 * fica por baixo mostrando o que ainda falta.
 *
 * O número do nível é escrito por cima do brasão — a arte vem vazia de propósito,
 * porque o nível muda.
 */
export function LevelBar({ level, xp, xpToNextLevel, width }: LevelBarProps) {
  const height = Math.round(width * PROPORCAO);
  const progresso = xpToNextLevel > 0 ? Math.max(0, Math.min(1, xp / xpToNextLevel)) : 0;
  const brasao = width * BRASAO_TAMANHO;

  /*
   * O preenchimento cresce até a marca nova em vez de aparecer nela. Ganhar XP passa a
   * ser uma coisa que a pessoa VÊ acontecer — que é o ponto inteiro de existir uma
   * barra de progresso em vez de um número.
   */
  const preenchido = useSharedValue(0);
  useEffect(() => {
    preenchido.value = withTiming(progresso, { duration: TEMPO.contagem, easing: CURVA.saida });
  }, [progresso, preenchido]);

  /* O canal, em pixels desta barra. É dentro dele que o preenchimento anda. */
  const canalEsquerda = width * CANAL_INICIO;
  const canalLargura = width * (CANAL_FIM - CANAL_INICIO);

  const animado = useAnimatedStyle(() => ({ width: canalLargura * preenchido.value }));

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
        style={[styles.recorte, { left: canalEsquerda }, animado]}
        pointerEvents="none"
      >
        <Image
          source={LOBBY_UI.barraNivelPreenchimento}
          style={{ width, height, marginLeft: -canalEsquerda }}
          resizeMode="contain"
        />
      </Animated.View>

      <View
        style={[
          styles.brasao,
          { left: width * BRASAO_X - brasao / 2, top: height * BRASAO_Y - brasao / 2, width: brasao, height: brasao },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.nivel, { fontSize: Math.round(brasao * 0.5) }]} numberOfLines={1} adjustsFontSizeToFit>
          {level}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camada: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  recorte: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  brasao: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  nivel: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
});
