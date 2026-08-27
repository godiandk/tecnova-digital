import { View, Text, StyleSheet, Image, Pressable } from 'react-native';

import { LOBBY_UI } from '../data/lobbyAssets';
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

function formatChips(amount: number): string {
  return amount.toLocaleString('pt-BR');
}

export function ChipStack({ amount, onPressAdd, width = 170 }: ChipStackProps) {
  const height = Math.round(width * PROPORCAO);

  return (
    <View style={[styles.container, { width, height }]}>
      <Image source={LOBBY_UI.hudFichas} style={styles.frame} resizeMode="contain" />
      <View
        style={[
          styles.numberArea,
          { left: width * MIOLO_ESQUERDA, right: width * MIOLO_DIREITA },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.amount, { fontSize: Math.round(height * 0.36) }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatChips(amount)}
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
    </View>
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
