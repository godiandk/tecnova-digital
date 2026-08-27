import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CURVA, TEMPO, cascata } from './movimento';

interface EntradaProps {
  children: ReactNode;
  /** Posição na lista — vira o atraso da cascata. */
  indice?: number;
  /** De onde vem: sobe do rodapé (padrão) ou só aparece. */
  de?: 'baixo' | 'nenhum';
  style?: StyleProp<ViewStyle>;
}

/**
 * Faz o conteúdo entrar em cena, com atraso proporcional à posição na lista.
 *
 * O efeito que interessa não é o de cada item: é o da lista assentando em cascata, que
 * dá a impressão de que a tela foi montada e não de que ela apareceu pronta. É o mesmo
 * truque que os apps de cassino usam pra o lobby parecer vivo ao abrir.
 */
export function Entrada({ children, indice = 0, de = 'baixo', style }: EntradaProps) {
  const opacidade = useSharedValue(0);
  const deslocamento = useSharedValue(de === 'baixo' ? 18 : 0);

  useEffect(() => {
    const atraso = cascata(indice);
    opacidade.value = withDelay(atraso, withTiming(1, { duration: TEMPO.entrada, easing: CURVA.saida }));
    deslocamento.value = withDelay(atraso, withTiming(0, { duration: TEMPO.entrada, easing: CURVA.saida }));
  }, [indice, opacidade, deslocamento]);

  const animado = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ translateY: deslocamento.value }],
  }));

  return <Animated.View style={[style, animado]}>{children}</Animated.View>;
}
