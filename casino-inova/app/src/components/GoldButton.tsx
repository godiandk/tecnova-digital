import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface GoldButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'gold' | 'felt';
  /** Desligado: não responde ao toque e aparece apagado. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GoldButton({ label, onPress, variant = 'gold', disabled = false, style }: GoldButtonProps) {
  const gradientColors: [string, string] =
    variant === 'gold' ? [colors.goldBright, colors.gold] : [colors.feltBright, colors.felt];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        <Text style={[styles.label, variant === 'felt' && { color: colors.textPrimary }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: fontSize.base,
    color: colors.background,
    letterSpacing: 0.3,
  },
});
