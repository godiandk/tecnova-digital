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
import { Carta } from '../../components/Carta';
import { RoadmapPanel } from '../../components/RoadmapPanel';
import { ApiError } from '../../api/client';
import { Roadmap } from '../../api/roadmap';
import { fetchBaccaratConfig, fetchBaccaratRoadmap, playBaccaratRound, BaccaratConfig, BaccaratBetType, BaccaratRoundResponse } from '../../api/baccarat';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Baccarat'>;

/** Largura da carta. Três por lado, que é o máximo no bacará. */
const LARGURA_DA_CARTA = 58;

const BET_STEP = 50;

const BET_OPTIONS: { type: BaccaratBetType; label: string; multiplier: string }[] = [
  { type: 'jogador', label: 'Jogador', multiplier: '×2' },
  { type: 'banca', label: 'Banca', multiplier: '×1,95' },
  { type: 'empate', label: 'Empate', multiplier: '×9' },
];

const OUTCOME_LABEL: Record<BaccaratBetType, string> = {
  jogador: 'Jogador venceu',
  banca: 'Banca venceu',
  empate: 'Empate',
};

function Hand({ label, cards, total }: { label: string; cards: string[]; total: number }) {
  return (
    <View style={styles.handBlock}>
      <Text style={styles.handLabel}>
        {label} · {total}
      </Text>
      <View style={styles.cardRow}>
        {cards.map((card, index) => (
          <Carta key={index} carta={card} indice={index} largura={LARGURA_DA_CARTA} />
        ))}
      </View>
    </View>
  );
}

export function BaccaratScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('bacara');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<BaccaratConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [amount, setAmount] = useState(100);
  const [betType, setBetType] = useState<BaccaratBetType>('banca');
  const [round, setRound] = useState<BaccaratRoundResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    fetchBaccaratConfig()
      .then((data) => {
        setConfig(data);
        setAmount(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
    fetchBaccaratRoadmap().then(setRoadmap).catch(() => undefined);
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmount((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const handlePlay = async () => {
    if (!config || playing) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const result = await playBaccaratRound(betType, amount);
      setRound(result);
      setBalance(result.newBalance);
      setRoadmap(result.roadmap);
    } catch (error) {
      setPlayError(error instanceof ApiError ? error.message : 'Não foi possível apostar agora.');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <GameBackdrop source={TABLE_IMAGES.bacara}>
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.bacara} />
          <Text style={styles.title}>Bacará</Text>
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
            <View style={styles.table}>
              {round ? (
                <>
                  <Hand label="Banca" cards={round.bankerCards} total={round.bankerTotal} />
                  <Hand label="Jogador" cards={round.playerCards} total={round.playerTotal} />
                </>
              ) : (
                <Text style={styles.placeholderText}>Escolha onde apostar e mande jogar.</Text>
              )}
            </View>

            {round && (
              <Text style={[styles.resultLabel, round.winner === round.betType ? styles.resultWin : styles.resultLoss]}>
                {OUTCOME_LABEL[round.winner]}
                {round.totalReturn > 0 ? ` — +${round.totalReturn.toLocaleString('pt-BR')} fichas` : ' — não foi dessa vez'}
              </Text>
            )}

            {playError && <Text style={styles.errorText}>{playError}</Text>}

            <Text style={styles.sectionLabel}>Sua aposta</Text>
            <View style={styles.betTypes}>
              {BET_OPTIONS.map((option) => (
                <Pressable
                  key={option.type}
                  onPress={() => setBetType(option.type)}
                  style={[styles.betTypeChip, betType === option.type && styles.betTypeChipActive]}
                  disabled={playing}
                >
                  <Text style={[styles.betTypeLabel, betType === option.type && styles.betTypeLabelActive]}>
                    {option.label} · {option.multiplier}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.betRow}>
              <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.betButton} disabled={playing}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Aposta</Text>
                <Text style={styles.betAmount}>{amount.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.betButton} disabled={playing}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable onPress={handlePlay} disabled={playing} style={[styles.primaryButton, playing && styles.buttonDisabled]}>
              {playing ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Apostar</Text>}
            </Pressable>

            {roadmap && roadmap.totals.total > 0 && <RoadmapPanel roadmap={roadmap} />}
          </>
        )}
        </ScrollView>
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Bacará"
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  table: { width: '100%', marginTop: spacing.xl, gap: spacing.xl, minHeight: 200, justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.textFaint, textAlign: 'center' },
  handBlock: { gap: spacing.sm, alignItems: 'center' },
  handLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textSecondary },
  cardRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, marginTop: spacing.lg, textAlign: 'center' },
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
  betTypeChipActive: { backgroundColor: colors.feltBright, borderColor: colors.feltBright },
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
  betValue: { alignItems: 'center', minWidth: 100 },
  betLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
