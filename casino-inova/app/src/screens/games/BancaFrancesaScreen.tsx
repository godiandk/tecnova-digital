import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
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
import { RoadmapPanel } from '../../components/RoadmapPanel';
import { ApiError } from '../../api/client';
import { Roadmap } from '../../api/roadmap';
import {
  fetchBancaFrancesaConfig,
  fetchBancaFrancesaRoadmap,
  playBancaFrancesaRound,
  BancaFrancesaBetType,
  BancaFrancesaConfig,
  BancaFrancesaRoundResponse,
} from '../../api/bancaFrancesa';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesa'>;

const BET_STEP = 50;

const BET_OPTIONS: { type: BancaFrancesaBetType; label: string; description: string; payoutLabel: string }[] = [
  { type: 'pequeno', label: 'Pequeno', description: 'Soma 5, 6 ou 7', payoutLabel: 'paga 1 p/ 1' },
  { type: 'grande', label: 'Grande', description: 'Soma 14, 15 ou 16', payoutLabel: 'paga 1 p/ 1' },
  { type: 'ases', label: 'Ases', description: 'Soma 3 (raro!)', payoutLabel: 'paga 61 p/ 1' },
  { type: 'linha', label: 'Linha', description: 'Metade Grande + metade Pequeno', payoutLabel: 'só perde se sair Ases' },
];

const OUTCOME_LABEL: Record<string, string> = { ases: 'Ases', pequeno: 'Pequeno', grande: 'Grande' };

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
  const [amountPerBet, setAmountPerBet] = useState(100);
  const [selected, setSelected] = useState<Set<BancaFrancesaBetType>>(new Set());
  const [round, setRound] = useState<BancaFrancesaRoundResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  useEffect(() => {
    fetchBancaFrancesaConfig()
      .then((data) => {
        setConfig(data);
        setAmountPerBet(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
    fetchBancaFrancesaRoadmap().then(setRoadmap).catch(() => undefined);
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmountPerBet((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const toggleBet = (type: BancaFrancesaBetType) => {
    if (playing) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else if (config && next.size < config.maxSimultaneousBets) {
        next.add(type);
      }
      return next;
    });
  };

  const totalStake = amountPerBet * selected.size;

  const handlePlay = async () => {
    if (!config || playing || selected.size === 0) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const bets = Array.from(selected).map((type) => ({ type, amount: amountPerBet }));
      const result = await playBancaFrancesaRound(bets);
      setRound(result);
      setBalance(result.newBalance);
      setRoadmap(result.roadmap);
    } catch (error) {
      setPlayError(error instanceof ApiError ? error.message : 'Não foi possível apostar agora.');
    } finally {
      setPlaying(false);
    }
  };

  const resultByType = new Map(round?.results.map((result) => [result.type, result]));
  const rtpLabel = config ? (config.theoreticalRtpByType.pequeno * 100).toFixed(1) : null;

  return (
    <GameBackdrop source={TABLE_IMAGES['banca-francesa']}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <View style={styles.topActions}>
            <Pressable onPress={() => navigation.navigate('BancaFrancesaMesa')} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="people" size={22} color={colors.goldBright} />
            </Pressable>
            <Pressable onPress={() => setTutorialVisible(true)} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="help-circle" size={24} color={colors.goldBright} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.rtpLabel}>RTP divulgado: {rtpLabel}% (igual em todas as apostas)</Text>

            <View style={styles.diceRow}>
              {(round?.dice ?? [null, null, null]).map((die, index) => (
                <View key={index} style={styles.die}>
                  <Text style={styles.dieLabel}>{die ?? '–'}</Text>
                </View>
              ))}
            </View>
            {round && (
              <Text style={styles.outcomeLabel}>
                Soma {round.sum} → {OUTCOME_LABEL[round.outcome]}
                {round.rerolls > 0 ? ` (relançou ${round.rerolls}x até decidir)` : ''}
              </Text>
            )}

            <View style={styles.betGrid}>
              {BET_OPTIONS.map((option) => {
                const isSelected = selected.has(option.type);
                const result = resultByType.get(option.type);
                return (
                  <Pressable
                    key={option.type}
                    onPress={() => toggleBet(option.type)}
                    style={[styles.betTile, isSelected && styles.betTileSelected, result?.won && styles.betTileWon]}
                    disabled={playing}
                  >
                    <Text style={styles.betLabel}>{option.label}</Text>
                    <Text style={styles.betDescription}>{option.description}</Text>
                    <Text style={styles.betPayout}>{option.payoutLabel}</Text>
                    {result && (
                      <Text style={styles.betResult}>
                        {result.won ? `+${result.totalReturn.toLocaleString('pt-BR')}` : '—'}
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
                <Text style={styles.betValueLabel}>Por aposta · {selected.size} escolhida(s)</Text>
                <Text style={styles.betAmount}>{amountPerBet.toLocaleString('pt-BR')}</Text>
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

            {roadmap && roadmap.totals.total > 0 && <RoadmapPanel roadmap={roadmap} />}
          </>
        )}
        </ScrollView>
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
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  scroll: { alignItems: 'center', paddingBottom: spacing.xxxl },
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
  topActions: { flexDirection: 'row', gap: spacing.xs },
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
  outcomeLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright, marginTop: spacing.sm },
  betGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    maxWidth: 2 * 150 + spacing.sm,
  },
  betTile: {
    width: 150,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  betTileSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  betTileWon: { borderColor: colors.success },
  betLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: colors.textPrimary },
  betDescription: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  betPayout: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  betResult: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.goldBright },
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
  betValueLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
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
