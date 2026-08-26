import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mockPlayer } from '../data/mockPlayer';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { GoldButton } from '../components/GoldButton';

export function FriendsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Amigos</Text>

      <GoldButton label="Adicionar amigo" variant="felt" style={styles.addButton} onPress={() => {}} />

      <FlatList
        data={mockPlayer.friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CasinoCard style={styles.row}>
            <View style={styles.avatar} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={[styles.rowStatus, item.online && styles.rowStatusOnline]}>
                {item.online ? 'Online agora' : 'Offline'}
              </Text>
            </View>
          </CasinoCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.lg },
  addButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  list: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundElevated, borderWidth: 2, borderColor: colors.feltLine },
  rowInfo: { gap: 2 },
  rowName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  rowStatus: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  rowStatusOnline: { color: colors.success },
});
