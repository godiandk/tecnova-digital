import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface ChipStackProps {
  amount: number;
}

function formatChips(amount: number): string {
  return amount.toLocaleString('pt-BR');
}

export function ChipStack({ amount }: ChipStackProps) {
  return (
    <View style={styles.container}>
      <View style={styles.chipIcon} />
      <Text style={styles.amount}>{formatChips(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    gap: spacing.sm,
  },
  chipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  amount: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
