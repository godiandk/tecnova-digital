import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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
import { fetchBancaFrancesaConfig, playBancaFrancesaRound, BancaFrancesaConfig, BancaFrancesaRoundResponse } from '../../api/bancaFrancesa';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesa'>;

const BET_STEP = 50;
const NUMBERS = [1, 2, 3, 4, 5, 6];

const CREW = [
  { source: DEALER_IMAGES.bancaFrancesaBanqueiro, label: 'Banqueiro' },
  { source: DEALER_IMAGES.bancaFrancesaTirador, label: 'Tirador' },
  { source: DEALER_IMAGES.bancaFrancesaApontador, label: 'Apontador' },
];

export function BancaFrancesaScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('banca-francesa');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<BancaFrancesaConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [amountPerNumber, setAmountPerNumber] = useState(100);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [round, setRound] = useState<BancaFrancesaRoundResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    fetchBancaFrancesaConfig()
      .then((data) => {
        setConfig(data);
        setAmountPerNumber(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmountPerNumber((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const toggleNumber = (number: number) => {
    if (playing) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(number)) {
        next.delete(number);
      } else if (config && next.size < config.maxSimultaneousNumbers) {
        next.add(number);
      }
      return next;
    });
  };

  const totalStake = amountPerNumber * selected.size;

  const handlePlay = async () => {
    if (!config || playing || selected.size === 0) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const bets = Array.from(selected).map((number) => ({ number, amount: amountPerNumber }));
      const result = await playBancaFrancesaRound(bets);
      setRound(result);
      setBalance(result.newBalance);
    } catch (error) {
      setPlayError(error instanceof ApiError ? error.message : 'Não foi possível apostar agora.');
    } finally {
      setPlaying(false);
    }
  };

  const resultByNumber = new Map(round?.results.map((result) => [result.number, result]));

  return (
    <GameBackdrop source={TABLE_IMAGES['banca-francesa']}>
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

        <Text style={styles.title}>Banca Francesa</Text>

        <View style={styles.crewRow}>
          {CREW.map((member) => (
            <View key={member.label} style={styles.crewMember}>
              <DealerBadge source={member.source} size={40} />
              <Text style={styles.crewLabel}>{member.label}</Text>
            </View>
          ))}
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && (
          <>
            <Text style={styles.rtpLabel}>RTP divulgado: {(config.theoreticalRtp * 100).toFixed(1)}%</Text>

            <View style={styles.diceRow}>
              {(round?.dice ?? [null, null, null]).map((die, index) => (
                <View key={index} style={styles.die}>
                  <Text style={styles.dieLabel}>{die ?? '–'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.numberGrid}>
              {NUMBERS.map((number) => {
                const isSelected = selected.has(number);
                const result = resultByNumber.get(number);
                const won = result && result.matches > 0;
                return (
                  <Pressable
                    key={number}
                    onPress={() => toggleNumber(number)}
                    style={[styles.numberTile, isSelected && styles.numberTileSelected, won && styles.numberTileWon]}
                    disabled={playing}
                  >
                    <Text style={styles.numberLabel}>{number}</Text>
                    {result && (
                      <Text style={styles.numberResult}>
                        {result.matches > 0 ? `+${result.totalReturn.toLocaleString('pt-BR')}` : '—'}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {playError && <Text style={styles.errorText}>{playError}</Text>}

            <View style={styles.betRow}>
              <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.betButton} disabled={playing}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Por número · {selected.size} escolhido(s)</Text>
                <Text style={styles.betAmount}>{amountPerNumber.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.betButton} disabled={playing}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable
              onPress={handlePlay}
              disabled={playing || selected.size === 0}
              style={[styles.primaryButton, (playing || selected.size === 0) && styles.buttonDisabled]}
            >
              {playing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonLabel}>Apostar {totalStake.toLocaleString('pt-BR')}</Text>
              )}
            </Pressable>
          </>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Banca Francesa"
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg },
  crewRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  crewMember: { alignItems: 'center', gap: spacing.xs },
  crewLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  rtpLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.md },
  diceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  die: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  dieLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.background },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.xl, maxWidth: 3 * 88 + 2 * spacing.sm },
  numberTile: {
    width: 88,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  numberTileSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  numberTileWon: { borderColor: colors.success },
  numberLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  numberResult: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textFaint },
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
  betValue: { alignItems: 'center', minWidth: 160 },
  betLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
