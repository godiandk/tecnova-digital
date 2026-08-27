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
 * Centro do brasão redondo na ponta esquerda da calha, em fração da imagem — é onde
 * o número do nível é escrito. Medido na própria arte.
 */
const BRASAO_X = 0.062;
const BRASAO_Y = 0.425;
const BRASAO_TAMANHO = 0.117; // 94px de 800

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

  const animado = useAnimatedStyle(() => ({ width: width * preenchido.value }));

  return (
    <View style={{ width, height }} accessibilityLabel={`Nível ${level}, ${xp} de ${xpToNextLevel} XP`}>
      <Image source={LOBBY_UI.barraNivel} style={styles.camada} resizeMode="contain" />

      {/*
        O corte é feito por um contêiner com overflow escondido: a imagem do
        preenchimento continua na largura inteira lá dentro, então ela nunca estica
        nem deforma — só aparece menos dela.
      */}
      <Animated.View style={[styles.recorte, animado]} pointerEvents="none">
        <Image source={LOBBY_UI.barraNivelPreenchimento} style={{ width, height }} resizeMode="contain" />
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
  recorte: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  brasao: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  nivel: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
});
