import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize } from '../theme';

interface LevelBadgeProps {
  level: number;
  size?: number;
}

export function LevelBadge({ level, size = 32 }: LevelBadgeProps) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamily.displayBold,
    color: colors.goldBright,
  },
});
