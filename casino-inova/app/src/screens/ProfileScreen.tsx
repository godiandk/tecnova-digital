import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mockPlayer } from '../data/mockPlayer';
import { ApiError } from '../api/client';
import { redeemCoupon } from '../api/coupons';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { LevelBar } from '../components/LevelBar';
import { GoldButton } from '../components/GoldButton';

const VIP_LABEL: Record<typeof mockPlayer.vipTier, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  diamante: 'Diamante',
};

/** Largura útil do cartão de nível: a tela menos a margem e o respiro do cartão. */
const LARGURA_BARRA = Dimensions.get('window').width - spacing.xl * 2 - spacing.lg * 2;

export function ProfileScreen() {

  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleRedeem = async () => {
    if (!couponCode.trim() || redeeming) return;
    setRedeeming(true);
    setCouponMessage(null);
    try {
      const result = await redeemCoupon(couponCode.trim());
      setBalance(result.newBalance);
      setCouponMessage({ text: `Cupom resgatado — +${result.chips.toLocaleString('pt-BR')} fichas!`, ok: true });
      setCouponCode('');
    } catch (error) {
      setCouponMessage({ text: error instanceof ApiError ? error.message : 'Não foi possível resgatar agora.', ok: false });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBlock}>
        <View style={styles.avatar} />
        <Text style={styles.name}>{mockPlayer.name}</Text>
        <View style={styles.vipPill}>
          <Text style={styles.vipLabel}>Clube {VIP_LABEL[mockPlayer.vipTier]}</Text>
        </View>
      </View>

      <CasinoCard style={styles.levelCard}>
        <LevelBar
          level={mockPlayer.level}
          xp={mockPlayer.xp}
          xpToNextLevel={mockPlayer.xpToNextLevel}
          width={LARGURA_BARRA}
        />
        <Text style={styles.levelLabel}>
          {mockPlayer.xp} de {mockPlayer.xpToNextLevel} XP pro nível {mockPlayer.level + 1}
        </Text>
      </CasinoCard>

      <View style={styles.statsRow}>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{balance.toLocaleString('pt-BR')}</Text>
          <Text style={styles.statLabel}>Fichas</Text>
        </CasinoCard>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{mockPlayer.friends.length}</Text>
          <Text style={styles.statLabel}>Amigos</Text>
        </CasinoCard>
      </View>

      <CasinoCard style={styles.couponCard}>
        <Text style={styles.couponTitle}>Resgatar cupom</Text>
        <Text style={styles.couponSubtitle}>Tem um código de promoção? Cole aqui pra receber as fichas.</Text>
        <View style={styles.couponRow}>
          <TextInput
            value={couponCode}
            onChangeText={setCouponCode}
            placeholder="CÓDIGO DO CUPOM"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.couponInput}
            editable={!redeeming}
          />
          <GoldButton
            label={redeeming ? '...' : 'Resgatar'}
            onPress={handleRedeem}
            style={styles.couponButton}
          />
        </View>
        {redeeming && <ActivityIndicator color={colors.goldBright} style={{ marginTop: spacing.sm }} />}
        {couponMessage && (
          <Text style={[styles.couponMessage, couponMessage.ok ? styles.couponMessageOk : styles.couponMessageError]}>
            {couponMessage.text}
          </Text>
        )}
      </CasinoCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  headerBlock: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  name: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  vipPill: { backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  vipLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright },
  levelCard: { marginBottom: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  levelLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textFaint },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  statLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  couponCard: { gap: spacing.xs },
  couponTitle: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  couponSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginBottom: spacing.sm },
  couponRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  couponInput: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  couponButton: { paddingHorizontal: spacing.lg },
  couponMessage: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, marginTop: spacing.sm },
  couponMessageOk: { color: colors.success },
  couponMessageError: { color: colors.danger },
});
