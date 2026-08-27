import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fontFamily, spacing } from '../theme';

/**
 * O cabeçalho de uma seção do salão: o rótulo com um filete dourado que se apaga
 * pros lados.
 *
 * Substitui o rótulo cinza solto que estava ali antes. É o item 7 do
 * docs/design-atencao-visual.md — o filete separa as áreas sem precisar de linha de
 * formulário, e é o que dá o ar de placa de salão em vez de título de lista.
 */
export function TrilhoDourado({ titulo, contagem }: { titulo: string; contagem?: number }) {
  return (
    <View style={styles.linha}>
      <View style={styles.losango} />
      <Text style={styles.titulo}>{titulo}</Text>
      {contagem !== undefined && <Text style={styles.contagem}>{contagem}</Text>}
      <LinearGradient
        colors={[colors.goldDeep, 'rgba(138,100,32,0.15)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.filete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Losango art déco: o mesmo motivo que aparece nas molduras dos cartazes.
  losango: {
    width: 7,
    height: 7,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  titulo: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  contagem: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    color: colors.textFaint,
  },
  filete: { flex: 1, height: 1 },
});
