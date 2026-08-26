import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { DEALER_IMAGES } from '../../data/dealerImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { DealerBadge } from '../../components/DealerBadge';
import { ChipStack } from '../../components/ChipStack';
import { ApiError } from '../../api/client';
import { fetchRouletteConfig, spinRoulette, RouletteConfig, RouletteBetType, RouletteSpinResponse } from '../../api/roulette';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Roulette'>;

const BET_STEP = 50;

const BET_OPTIONS: { type: Exclude<RouletteBetType, 'numero'>; label: string }[] = [
  { type: 'vermelho', label: 'Vermelho' },
  { type: 'preto', label: 'Preto' },
  { type: 'par', label: 'Par' },
  { type: 'impar', label: 'Ímpar' },
  { type: 'baixo', label: '1-18' },
  { type: 'alto', label: '19-36' },
  { type: 'duzia1', label: '1ª Dúzia' },
  { type: 'duzia2', label: '2ª Dúzia' },
  { type: 'duzia3', label: '3ª Dúzia' },
];

const POCKET_COLOR: Record<'vermelho' | 'preto' | 'verde', string> = {
  vermelho: colors.ruby,
  preto: '#1B1F1D',
  verde: colors.feltBright,
};

export function RouletteScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('roleta');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [amount, setAmount] = useState(100);
  const [betType, setBetType] = useState<RouletteBetType>('vermelho');
  const [betNumber, setBetNumber] = useState(7);
  const [spinning, setSpinning] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RouletteSpinResponse | null>(null);

  useEffect(() => {
    fetchRouletteConfig()
      .then((data) => {
        setConfig(data);
        setAmount(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmount((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const adjustBetNumber = (delta: number) => {
    setBetNumber((current) => Math.max(0, Math.min(36, current + delta)));
  };

  const handleSpin = async () => {
    if (!config || spinning) return;
    setSpinning(true);
    setSpinError(null);
    try {
      const bet = betType === 'numero' ? { type: betType, number: betNumber } : { type: betType };
      const result = await spinRoulette(bet, amount);
      setLastResult(result);
      setBalance(result.newBalance);
    } catch (error) {
      setSpinError(error instanceof ApiError ? error.message : 'Não foi possível girar agora.');
    } finally {
      setSpinning(false);
    }
  };

  const multiplier = config ? config.totalMultiplier[betType] : undefined;

  return (
    <GameBackdrop source={TABLE_IMAGES.roleta}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <Pressable onPress={() => setTutorialVisible(true)} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.roleta} />
          <Text style={styles.title}>Roleta</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}

        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.rtpLabel}>RTP divulgado: {(config.theoreticalRtp * 100).toFixed(2)}%</Text>

            <View style={[styles.resultWheel, { backgroundColor: lastResult ? POCKET_COLOR[lastResult.color] : colors.backgroundElevated }]}>
              <Text style={styles.resultNumber}>{lastResult ? lastResult.pocket : '–'}</Text>
            </View>

            {lastResult && (
              <Text style={[styles.resultLabel, lastResult.win ? styles.resultWin : styles.resultLoss]}>
                {lastResult.win
                  ? `Caiu no ${lastResult.pocket} (${lastResult.color}) — você ganhou ${lastResult.totalReturn.toLocaleString('pt-BR')} fichas!`
                  : `Caiu no ${lastResult.pocket} (${lastResult.color}) — não foi dessa vez.`}
              </Text>
            )}

            {spinError && <Text style={styles.errorText}>{spinError}</Text>}

            <Text style={styles.sectionLabel}>Sua aposta</Text>
            <View style={styles.betTypes}>
              {BET_OPTIONS.map((option) => (
                <Pressable
                  key={option.type}
                  onPress={() => setBetType(option.type)}
                  style={[styles.betTypeChip, betType === option.type && styles.betTypeChipActive]}
                  disabled={spinning}
                >
                  <Text style={[styles.betTypeLabel, betType === option.type && styles.betTypeLabelActive]}>
                    {option.label} · ×{config.totalMultiplier[option.type]}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setBetType('numero')}
                style={[styles.betTypeChip, betType === 'numero' && styles.betTypeChipActive]}
                disabled={spinning}
              >
                <Text style={[styles.betTypeLabel, betType === 'numero' && styles.betTypeLabelActive]}>
                  Número exato · ×{config.totalMultiplier.numero}
                </Text>
              </Pressable>
            </View>

            {betType === 'numero' && (
              <View style={styles.betRow}>
                <Pressable onPress={() => adjustBetNumber(-1)} style={styles.betButton} disabled={spinning}>
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.betValue}>
                  <Text style={styles.betLabel}>Número</Text>
                  <Text style={styles.betAmount}>{betNumber}</Text>
                </View>
                <Pressable onPress={() => adjustBetNumber(1)} style={styles.betButton} disabled={spinning}>
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>
            )}

            <View style={styles.betRow}>
              <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.betButton} disabled={spinning}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Aposta{multiplier ? ` (paga ×${multiplier})` : ''}</Text>
                <Text style={styles.betAmount}>{amount.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.betButton} disabled={spinning}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable onPress={handleSpin} disabled={spinning} style={[styles.spinButton, spinning && styles.spinButtonDisabled]}>
              {spinning ? <ActivityIndicator color={colors.background} /> : <Text style={styles.spinButtonLabel}>Girar</Text>}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Roleta"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  rtpLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  scrollContent: { alignItems: 'center', paddingBottom: spacing.xxxl },
  resultWheel: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    borderWidth: 3,
    borderColor: colors.goldBright,
  },
  resultNumber: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xxl, color: colors.textPrimary },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, marginTop: spacing.md, textAlign: 'center', maxWidth: 280 },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  betTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  betTypeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  betTypeChipActive: { backgroundColor: colors.ruby, borderColor: colors.ruby },
  betTypeLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  betTypeLabelActive: { color: colors.textPrimary },
  betRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  betButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betValue: { alignItems: 'center', minWidth: 140 },
  betLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  spinButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    minWidth: 180,
    alignItems: 'center',
  },
  spinButtonDisabled: { opacity: 0.6 },
  spinButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
