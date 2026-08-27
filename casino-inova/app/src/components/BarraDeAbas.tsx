import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, fontFamily, LARGURA_MAXIMA, useJanela } from '../theme';
import { MOLA } from '../animation';
import { Brilho } from '../animation/Brilho';

const ICONES: Record<string, { ativo: keyof typeof Ionicons.glyphMap; inativo: keyof typeof Ionicons.glyphMap }> = {
  Lobby: { ativo: 'diamond', inativo: 'diamond-outline' },
  Tournaments: { ativo: 'trophy', inativo: 'trophy-outline' },
  Store: { ativo: 'wallet', inativo: 'wallet-outline' },
  Friends: { ativo: 'people', inativo: 'people-outline' },
  Profile: { ativo: 'person-circle', inativo: 'person-circle-outline' },
};

const ROTULOS: Record<string, string> = {
  Lobby: 'Salão',
  Tournaments: 'Torneios',
  Store: 'Caixa',
  Friends: 'Amigos',
  Profile: 'Perfil',
};

const ALTURA = 62;

/**
 * A barra de baixo.
 *
 * A padrão do React Navigation é um ícone cinza com um rótulo cinza embaixo: funciona,
 * e não parece cassino nenhum. Aqui a aba ativa ganha uma placa dourada com brilho, o
 * ícone dela sobe um pouco e as outras ficam apagadas — o mesmo princípio de "gastar o
 * dourado só onde o olho deve ir" que o resto do app segue.
 *
 * A barra inteira é uma peça só, com filete dourado em cima e vidro escuro embaixo, em
 * vez de cinco botões soltos num retângulo.
 */
export function BarraDeAbas({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const janela = useJanela();

  // Num monitor a barra para de crescer junto com a tela, igual ao resto do conteúdo.
  const largura = Math.min(janela.width, LARGURA_MAXIMA);

  return (
    <View style={[styles.moldura, { paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['rgba(11,15,13,0.92)', colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Filete dourado: separa a barra do conteúdo sem linha cinza de formulário. */}
      <LinearGradient
        colors={['transparent', colors.goldDeep, colors.gold, colors.goldDeep, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.filete}
      />
      <View style={[styles.linha, { width: largura }]}>
        {state.routes.map((route, indice) => (
          <Aba
            key={route.key}
            nome={route.name}
            ativa={state.index === indice}
            aoTocar={() => {
              const evento = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (state.index !== indice && !evento.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Aba({ nome, ativa, aoTocar }: { nome: string; ativa: boolean; aoTocar: () => void }) {
  const icone = ICONES[nome] ?? { ativo: 'ellipse', inativo: 'ellipse-outline' };
  const progresso = useDerivedValue(() => withSpring(ativa ? 1 : 0, MOLA), [ativa]);

  const placa = useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [{ scale: interpolate(progresso.value, [0, 1], [0.7, 1]) }],
  }));

  const conteudo = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progresso.value, [0, 1], [0, -2]) }],
  }));

  const cor = ativa ? colors.goldBright : colors.textFaint;

  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={ROTULOS[nome] ?? nome}
      style={styles.aba}
    >
      {/* A placa da aba ativa: fica atrás do ícone e do rótulo. */}
      <Animated.View style={[styles.placa, placa]}>
        <LinearGradient
          colors={['rgba(229,181,103,0.22)', 'rgba(229,181,103,0.05)']}
          style={StyleSheet.absoluteFillObject}
        />
        <Brilho largura={72} intervalo={5} cor="rgba(255,217,138,0.30)" />
      </Animated.View>

      <Animated.View style={[styles.conteudo, conteudo]}>
        <Ionicons name={ativa ? icone.ativo : icone.inativo} size={22} color={cor} />
        <Text style={[styles.rotulo, { color: cor }]} numberOfLines={1}>
          {ROTULOS[nome] ?? nome}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moldura: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(229,181,103,0.18)',
    alignItems: 'center',
  },
  filete: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  linha: { flexDirection: 'row', height: ALTURA, alignSelf: 'center' },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placa: {
    position: 'absolute',
    width: 72,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,181,103,0.45)',
  },
  conteudo: { alignItems: 'center', gap: 3 },
  rotulo: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
