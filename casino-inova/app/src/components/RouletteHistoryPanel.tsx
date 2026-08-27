import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

export interface RouletteHistory {
  numbers: { pocket: number; color: 'vermelho' | 'preto' | 'verde' }[];
  totals: {
    vermelho: number;
    preto: number;
    zero: number;
    par: number;
    impar: number;
    baixo: number;
    alto: number;
    total: number;
  };
}

const POCKET_COLOR: Record<string, string> = {
  vermelho: colors.ruby,
  preto: '#1A1A1A',
  verde: colors.feltBright,
};

/**
 * Placar da mesa de roleta. Diferente do bacará, roleta não usa as cinco estradas:
 * mostra a lista dos últimos números com a cor de cada um e os contadores das
 * apostas simples. É o painel que fica no pedestal ao lado da roda.
 *
 * O mais recente aparece primeiro (à esquerda), que é como a mesa real ordena.
 */
export function RouletteHistoryPanel({ history }: { history: RouletteHistory }) {
  const { totals } = history;
  const recentFirst = [...history.numbers].reverse();

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Últimos números</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.numbersRow}>
        {recentFirst.map((item, index) => (
          <View
            key={index}
            style={[
              styles.pocket,
              { backgroundColor: POCKET_COLOR[item.color] },
              index === 0 && styles.pocketLatest,
            ]}
          >
            <Text style={styles.pocketLabel}>{item.pocket}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.countersRow}>
        <Counter label="Vermelho" value={totals.vermelho} color={colors.ruby} />
        <Counter label="Preto" value={totals.preto} color="#1A1A1A" />
        <Counter label="Zero" value={totals.zero} color={colors.feltBright} />
      </View>
      <View style={styles.countersRow}>
        <Counter label="Par" value={totals.par} />
        <Counter label="Ímpar" value={totals.impar} />
        <Counter label="1-18" value={totals.baixo} />
        <Counter label="19-36" value={totals.alto} />
      </View>

      <Text style={styles.disclaimer}>
        A roda não tem memória — o que já saiu não muda a chance do próximo giro.
      </Text>
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.counter}>
      {color && <View style={[styles.counterDot, { backgroundColor: color }]} />}
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={styles.counterValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: spacing.xs,
    width: '100%',
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  numbersRow: { gap: 4, paddingVertical: 2 },
  pocket: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  pocketLatest: { borderColor: colors.goldBright, borderWidth: 2 },
  pocketLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.textPrimary },
  countersRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.feltLine },
  counterLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  counterValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.textPrimary },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
