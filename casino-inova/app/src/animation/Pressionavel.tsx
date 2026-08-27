import { ReactNode } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { MOLA, TEMPO } from './movimento';

interface PressionavelProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Quanto encolhe ao ser pressionado. Alvo grande encolhe menos. */
  escala?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Toque com resposta física: encolhe ao pressionar e volta com mola ao soltar.
 *
 * A mola importa mais do que parece. Voltar por tempo fixo dá a sensação de animação;
 * voltar com mola dá a sensação de material — o dedo apertou uma coisa que tem massa.
 * É a diferença entre "tem animação" e "é gostoso de usar", que é o que separa app de
 * cassino bom de app de cassino feito às pressas.
 *
 * A escala usa mola (reação a toque tem que ser instantânea) e a opacidade usa tempo
 * (o olho não estranha).
 */
export function Pressionavel({ children, onPress, disabled, escala = 0.96, style }: PressionavelProps) {
  const escalaAtual = useSharedValue(1);
  const opacidade = useSharedValue(1);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: escalaAtual.value }],
    opacity: opacidade.value,
  }));

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      onPressIn={() => {
        escalaAtual.value = withSpring(escala, MOLA);
        opacidade.value = withTiming(0.88, { duration: TEMPO.toque });
      }}
      onPressOut={() => {
        escalaAtual.value = withSpring(1, MOLA);
        opacidade.value = withTiming(1, { duration: TEMPO.toque });
      }}
    >
      <Animated.View style={[style, animado, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}
