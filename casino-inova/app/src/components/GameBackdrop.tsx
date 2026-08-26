import { ImageBackground, ImageSourcePropType, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

interface GameBackdropProps {
  source: ImageSourcePropType;
  children: React.ReactNode;
}

/** Foto real da mesa por baixo, com um degradê escurecendo de cima pra baixo pra manter o texto legível. */
export function GameBackdrop({ source, children }: GameBackdropProps) {
  return (
    <ImageBackground source={source} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(11,15,13,0.25)', colors.background]}
        locations={[0, 0.8]}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
