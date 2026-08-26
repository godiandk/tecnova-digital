import { Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface DealerBadgeProps {
  source: ImageSourcePropType;
  size?: number;
}

export function DealerBadge({ source, size = 44 }: DealerBadgeProps) {
  return (
    <Image
      source={source}
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    borderColor: colors.goldBright,
    backgroundColor: colors.backgroundElevated,
  },
});
