import { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { LOBBY_UI } from '../data/lobbyAssets';
import { useContagem, MOLA, TEMPO } from '../animation';
import { colors, fontFamily, fontSize } from '../theme';

interface ChipStackProps {
  amount: number;
  /** Chamado no botão "+" da moldura — atalho pra loja. Sem isso, o + não é clicável. */
  onPressAdd?: () => void;
  width?: number;
}

/** A moldura é 600x200. */
const PROPORCAO = 200 / 600;

/**
 * Onde fica o miolo vazio da cápsula, em fração da largura: a pilha de fichas ocupa a
 * esquerda e o botão "+" a direita, então o número mora no meio. Medido na própria
 * imagem — se a arte da moldura mudar, remede aqui.
 */
const MIOLO_ESQUERDA = 0.29;
const MIOLO_DIREITA = 0.17;
/** Área do botão "+", na ponta direita, pra virar alvo de toque. */
const BOTAO_MAIS = 0.16;

/**
 * O saldo escrito na cápsula. Encurta quando não cabe.
 *
 * "99.999.995.277" tem catorze caracteres e NÃO CABE no vão da moldura em tela de
 * celular — sai cortado como "99.999.99…", que é pior do que arredondar: quem lê não
 * sabe se tem 99 milhões ou 99 bilhões.
 *
 * Até nove dígitos (999 milhões) vai por extenso, com os pontos, porque cabe e porque
 * ver o número exato importa. Passando disso vira "99,99 bi", que é como qualquer jogo
 * escreve saldo grande — e o número exato continua no perfil, onde há espaço.
 */
function formatChips(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2).replace('.', ',')} bi`;
  }
  return amount.toLocaleString('pt-BR');
}

/** Encolhe a letra conforme o número cresce, pra sempre caber inteiro no vão. */
function tamanhoDaFonte(altura: number, digitos: number): number {
  const base = altura * 0.36;
  if (digitos <= 6) return Math.round(base);
  if (digitos <= 9) return Math.round(base * 0.82);
  return Math.round(base * 0.68);
}

export function ChipStack({ amount, onPressAdd, width = 200 }: ChipStackProps) {
  const height = Math.round(width * PROPORCAO);

  /*
   * O saldo sobe contando, e a cápsula dá um pulinho quando o número muda.
   *
   * Sem isso, ganhar 500 fichas é um número diferente na tela e nada mais. Com isso, o
   * ganho vira acontecimento — e o tamanho do ganho dá pra sentir pela duração da
   * contagem, sem ninguém precisar ler nada.
   */
  const exibido = useContagem(amount, TEMPO.contagem);
  const pulo = useSharedValue(1);

  useEffect(() => {
    pulo.value = withSequence(withTiming(1.08, { duration: 140 }), withSpring(1, MOLA));
  }, [amount, pulo]);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: pulo.value }] }));

  return (
    <Animated.View style={[styles.container, { width, height }, animado]}>
      <Image source={LOBBY_UI.hudFichas} style={styles.frame} resizeMode="contain" />
      <View
        style={[
          styles.numberArea,
          { left: width * MIOLO_ESQUERDA, right: width * MIOLO_DIREITA },
        ]}
        pointerEvents="none"
      >
        {/*
          `adjustsFontSizeToFit` não funciona na web, então o tamanho da fonte é
          calculado pelo número de dígitos: saldo de 6 ou 7 casas encolhe a letra em vez
          de virar "132.5...". Sem isso, o jogador não enxerga o próprio saldo.
        */}
        <Text style={[styles.amount, { fontSize: tamanhoDaFonte(height, formatChips(amount).length) }]} numberOfLines={1}>
          {formatChips(exibido)}
        </Text>
      </View>
      {onPressAdd && (
        <Pressable
          onPress={onPressAdd}
          style={[styles.addHit, { width: width * BOTAO_MAIS }]}
          hitSlop={8}
          accessibilityLabel="Comprar fichas"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  frame: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  numberArea: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  amount: {
    fontFamily: fontFamily.bodyBold,
    color: colors.goldBright,
    fontVariant: ['tabular-nums'],
  },
  addHit: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});
