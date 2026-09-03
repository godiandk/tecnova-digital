import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chipPackages } from '../data/chipPackages';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { Fundo } from '../components/Fundo';
import { FUNDOS } from '../data/artePorTela';
import { GoldButton } from '../components/GoldButton';

export function StoreScreen() {
  return (
    /* O cofre de ouro é o fundo da loja desde que a arte foi feita; só faltava alguém
       desenhar. O escurecido por cima é o que mantém o texto legível sobre a foto. */
    <Fundo source={FUNDOS.loja} style={styles.fundo}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Loja de fichas</Text>
      <Text style={styles.subtitle}>Fichas são só pra jogar dentro do Casino Inova — não têm valor de saque.</Text>

      <FlatList
        data={chipPackages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CasinoCard style={styles.packageCard}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageChips}>{item.chips.toLocaleString('pt-BR')} fichas</Text>
              {item.bonusLabel && <Text style={styles.packageBonus}>{item.bonusLabel}</Text>}
            </View>
            <GoldButton label={item.priceLabel} onPress={() => {}} />
          </CasinoCard>
        )}
      />
    </SafeAreaView>
    </Fundo>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1 },
  container: { flex: 1, backgroundColor: 'rgba(6,9,8,0.62)', paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs, marginBottom: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xxxl },
  packageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageInfo: { gap: spacing.xs },
  packageChips: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  packageBonus: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.success },
});
