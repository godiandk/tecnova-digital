import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { getGameById } from '../data/games';
import { getGameMode, GameModeOption } from '../data/gameModes';
import { TABLE_IMAGES } from '../data/tableImages';
import { GameBackdrop } from '../components/GameBackdrop';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

/**
 * Tela do meio: aparece só pros jogos que têm mais de um jeito de jogar (truco,
 * dominó, banca francesa). Os grupos vêm de gameModes.ts — variante primeiro, modo
 * depois — e a escolha de cada grupo vai se acumulando até a última, que é a que
 * dispara a navegação.
 */
export function GameModeScreen({ navigation, route }: Props) {
  const { gameId } = route.params;
  const game = getGameById(gameId);
  const config = getGameMode(gameId);

  const [escolhas, setEscolhas] = useState<Record<string, GameModeOption>>({});

  if (!config?.groups) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={styles.errorText}>Esse jogo não tem modos pra escolher.</Text>
      </SafeAreaView>
    );
  }

  const grupos = config.groups;
  const ultimoGrupo = grupos[grupos.length - 1];

  const escolher = (grupoTitulo: string, option: GameModeOption) => {
    if (option.comingSoon) return;

    const novas = { ...escolhas, [grupoTitulo]: option };
    setEscolhas(novas);

    // Só navega quando o último grupo for escolhido — antes disso é só ir montando.
    if (grupoTitulo !== ultimoGrupo.title) return;

    // Junta os parâmetros de todas as escolhas (variante + modo, por exemplo).
    const params = Object.values(novas).reduce<Record<string, unknown>>(
      (acc, item) => ({ ...acc, ...(item.params ?? {}) }),
      {},
    );
    navigation.replace(option.route as never, params as never);
  };

  return (
    <GameBackdrop source={TABLE_IMAGES[gameId]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{game?.name ?? 'Escolha o modo'}</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {grupos.map((grupo) => {
            const escolhido = escolhas[grupo.title];
            return (
              <View key={grupo.title} style={styles.group}>
                <Text style={styles.groupTitle}>{grupo.title}</Text>
                {grupo.options.map((option) => {
                  const selecionado = escolhido?.id === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => escolher(grupo.title, option)}
                      disabled={option.comingSoon}
                      style={[
                        styles.option,
                        selecionado && styles.optionSelected,
                        option.comingSoon && styles.optionDisabled,
                      ]}
                    >
                      <View style={styles.optionText}>
                        <View style={styles.optionHeader}>
                          <Text style={styles.optionLabel}>{option.label}</Text>
                          {option.comingSoon && <Text style={styles.badge}>em breve</Text>}
                        </View>
                        <Text style={styles.optionHint}>{option.hint}</Text>
                      </View>
                      {!option.comingSoon && (
                        <Ionicons
                          name={selecionado ? 'checkmark-circle' : 'chevron-forward'}
                          size={22}
                          color={selecionado ? colors.goldBright : colors.textFaint}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  fallback: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  scroll: { paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  group: { gap: spacing.sm },
  groupTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.feltLine,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  optionDisabled: { opacity: 0.45 },
  optionText: { flex: 1, gap: 2 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  badge: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    borderWidth: 1,
    borderColor: colors.feltLine,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  optionHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger },
});
