import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { ChipStack } from '../../components/ChipStack';
import { RoadmapPanel } from '../../components/RoadmapPanel';
import { BACBO_DIE_IMAGES } from '../../data/gameAssets';
import { ApiError } from '../../api/client';
import { Roadmap } from '../../api/roadmap';
import {
  fetchBacBoConfig,
  fetchBacBoRoadmap,
  playBacBoRound,
  BacBoBetType,
  BacBoConfig,
  BacBoRoundResponse,
} from '../../api/bacBo';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BacBo'>;

const BET_STEP = 50;

const BET_OPTIONS: { type: BacBoBetType; label: string; hint: string }[] = [
  { type: 'jogador', label: 'Player', hint: 'paga 1 por 1' },
  { type: 'banca', label: 'Banker', hint: 'paga 1 por 1' },
  { type: 'empate', label: 'Empate', hint: 'até 88 por 1' },
];

const OUTCOME_LABEL: Record<BacBoBetType, string> = {
  jogador: 'Player',
  banca: 'Banker',
  empate: 'Empate',
};

export function BacBoScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('bac-bo');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<BacBoConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [amountPerBet, setAmountPerBet] = useState(100);
  const [selected, setSelected] = useState<Set<BacBoBetType>>(new Set());
  const [round, setRound] = useState<BacBoRoundResponse | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    fetchBacBoConfig()
      .then((data) => {
        setConfig(data);
        setAmountPerBet(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
    fetchBacBoRoadmap().then(setRoadmap).catch(() => undefined);
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmountPerBet((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const toggleBet = (type: BacBoBetType) => {
    if (playing) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handlePlay = async () => {
    if (!config || playing || selected.size === 0) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const bets = Array.from(selected).map((type) => ({ type, amount: amountPerBet }));
      const result = await playBacBoRound(bets);
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
  const totalStake = amountPerBet * selected.size;

  return (
    <GameBackdrop source={TABLE_IMAGES['bac-bo']}>
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
          <Text style={styles.title}>Bac Bo</Text>

          {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
          {configError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{configError}</Text>
              <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
            </View>
          )}

          {config && (
            <>
              <Text style={styles.rtpLabel}>
                RTP divulgado: Player/Banker {(config.theoreticalRtpByType.jogador * 100).toFixed(2)}% · Empate{' '}
                {(config.theoreticalRtpByType.empate * 100).toFixed(2)}%
              </Text>

              {/* Player e Banker com 2 dados cada — é assim que a mesa real mostra. */}
              <View style={styles.sidesRow}>
                <DiceSide
                  label="Player"
                  dice={round?.playerDice}
                  total={round?.playerTotal}
                  won={round?.outcome === 'jogador'}
                  accent={colors.sapphire}
                />
                <DiceSide
                  label="Banker"
                  dice={round?.bankerDice}
                  total={round?.bankerTotal}
                  won={round?.outcome === 'banca'}
                  accent={colors.ruby}
                />
              </View>

              {round && (
                <Text style={styles.outcomeLabel}>
                  {OUTCOME_LABEL[round.outcome]}
                  {round.outcome === 'empate' ? ` no ${round.playerTotal}` : ''}
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
                      <Text style={styles.betHint}>{option.hint}</Text>
                      {result && (
                        <Text style={styles.betResult}>
                          {result.totalReturn > 0 ? `+${result.totalReturn.toLocaleString('pt-BR')}` : '—'}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.tieNote}>
                No empate, quem apostou em Player ou Banker recebe 90% da ficha de volta.
              </Text>

              {playError && <Text style={styles.errorText}>{playError}</Text>}

              <View style={styles.betRow}>
                <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.stepButton} disabled={playing}>
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.betValue}>
                  <Text style={styles.betValueLabel}>Por aposta · {selected.size} escolhida(s)</Text>
                  <Text style={styles.betAmount}>{amountPerBet.toLocaleString('pt-BR')}</Text>
                </View>
                <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.stepButton} disabled={playing}>
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

      <TutorialModal visible={tutorialVisible} gameName="Bac Bo" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
    </GameBackdrop>
  );
}

function DiceSide({
  label,
  dice,
  total,
  won,
  accent,
}: {
  label: string;
  dice?: number[];
  total?: number;
  won?: boolean;
  accent: string;
}) {
  return (
    <View style={[styles.side, won && { borderColor: accent }]}>
      <Text style={[styles.sideLabel, { color: accent }]}>{label}</Text>
      <View style={styles.diceRow}>
        {(dice ?? [null, null]).map((die, index) =>
          die ? (
            <Image key={index} source={BACBO_DIE_IMAGES[die]} style={styles.die} resizeMode="contain" />
          ) : (
            <View key={index} style={[styles.die, styles.dieEmpty]} />
          ),
        )}
      </View>
      <Text style={styles.sideTotal}>{total ?? '–'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scroll: { paddingBottom: spacing.xxxl, gap: spacing.sm, alignItems: 'stretch' },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  rtpLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  sidesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.overlay,
  },
  sideLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm },
  diceRow: { flexDirection: 'row', gap: spacing.sm },
  die: { width: 52, height: 52 },
  dieEmpty: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.overlay,
  },
  sideTotal: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.lg, color: colors.textPrimary },
  outcomeLabel: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: fontSize.md,
    color: colors.goldBright,
    textAlign: 'center',
  },
  betGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  betTile: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.feltLine,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  betTileSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  betTileWon: { borderColor: colors.success },
  betLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  betHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betResult: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright },
  tieNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  betRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  stepButton: {
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
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
