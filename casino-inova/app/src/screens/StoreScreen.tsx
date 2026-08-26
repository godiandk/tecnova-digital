import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chipPackages } from '../data/mockPlayer';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { GoldButton } from '../components/GoldButton';

export function StoreScreen() {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs, marginBottom: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xxxl },
  packageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageInfo: { gap: spacing.xs },
  packageChips: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  packageBonus: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.success },
});
