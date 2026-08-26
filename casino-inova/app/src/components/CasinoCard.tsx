import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface CasinoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Painel base usado em todas as telas — feltro escuro com borda dourada fina. */
export function CasinoCard({ children, style }: CasinoCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.lg,
  },
});
