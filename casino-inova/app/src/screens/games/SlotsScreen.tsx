import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TutorialModal } from '../../components/TutorialModal';
import { ChipStack } from '../../components/ChipStack';
import { ApiError } from '../../api/client';
import { fetchSlotsConfig, spinSlots, SlotsConfig, WinningLineDto } from '../../api/slots';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Slots'>;

const BET_STEP = 50;

/** Cores de placeholder só pra diferenciar os símbolos visualmente até a arte real chegar. */
const SYMBOL_COLOR: Record<string, string> = {
  ferradura: '#8A7355',
  sino: '#9AA79E',
  barras: '#43514A',
  estrela: '#3D7DE0',
  moeda: '#E5B567',
  coroa: '#E67E22',
  diamante: '#5FD3C4',
  sete: '#E63950',
  jackpot: '#FFD98A',
};

/** Espelha PAYLINES de server/src/modules/games/slots/slots.config.ts — só para destacar as células vencedoras. */
const PAYLINE_CELLS: Record<string, [number, number, number]> = {
  'linha-superior': [0, 1, 2],
  'linha-central': [3, 4, 5],
  'linha-inferior': [6, 7, 8],
  'diagonal-descendente': [0, 4, 8],
  'diagonal-ascendente': [6, 4, 2],
};

function winningCellSet(winningLines: WinningLineDto[]): Set<number> {
  const cells = new Set<number>();
  winningLines.forEach((line) => PAYLINE_CELLS[line.payline]?.forEach((cell) => cells.add(cell)));
  return cells;
}

export function SlotsScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('slots');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<SlotsConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState<string[] | null>(null);
  const [winningLines, setWinningLines] = useState<WinningLineDto[]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);

  useEffect(() => {
    fetchSlotsConfig()
      .then((data) => {
        setConfig(data);
        setBet(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const adjustBet = (delta: number) => {
    if (!config) return;
    setBet((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const handleSpin = async () => {
    if (!config || spinning) return;
    setSpinning(true);
    setSpinError(null);
    try {
      const result = await spinSlots(bet);
      setGrid(result.grid);
      setWinningLines(result.winningLines);
      setLastWin(result.totalWin);
      setBalance(result.newBalance);
    } catch (error) {
      setSpinError(error instanceof ApiError ? error.message : 'Não foi possível girar agora.');
    } finally {
      setSpinning(false);
    }
  };

  const highlighted = winningCellSet(winningLines);

  return (
    <LinearGradient colors={[colors.goldDeep, colors.background]} style={styles.container}>
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

        <Text style={styles.title}>Caça-Níqueis</Text>

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

            <View style={styles.grid}>
              {Array.from({ length: 9 }).map((_, index) => {
                const symbolId = grid?.[index];
                const isWinning = highlighted.has(index);
                return (
                  <View
                    key={index}
                    style={[
                      styles.cell,
                      { backgroundColor: symbolId ? SYMBOL_COLOR[symbolId] : colors.backgroundElevated },
                      isWinning && styles.cellWinning,
                    ]}
                  >
                    <Text style={styles.cellLabel} numberOfLines={1}>
                      {symbolId ? symbolId.slice(0, 3).toUpperCase() : '?'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {lastWin !== null && (
              <Text style={[styles.resultLabel, lastWin > 0 ? styles.resultWin : styles.resultLoss]}>
                {lastWin > 0 ? `Você ganhou ${lastWin.toLocaleString('pt-BR')} fichas!` : 'Não formou combinação — tente de novo.'}
              </Text>
            )}

            {spinError && <Text style={styles.errorText}>{spinError}</Text>}

            <View style={styles.betRow}>
              <Pressable onPress={() => adjustBet(-BET_STEP)} style={styles.betButton} disabled={spinning}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Aposta</Text>
                <Text style={styles.betAmount}>{bet.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustBet(BET_STEP)} style={styles.betButton} disabled={spinning}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Pressable onPress={handleSpin} disabled={spinning} style={[styles.spinButton, spinning && styles.spinButtonDisabled]}>
              {spinning ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.spinButtonLabel}>Girar</Text>
              )}
            </Pressable>
          </>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Caça-Níqueis"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  rtpLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.xs },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 3 * 88 + 2 * spacing.sm,
    gap: spacing.sm,
    marginTop: spacing.xl,
    justifyContent: 'center',
  },
  cell: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellWinning: { borderColor: colors.goldBright },
  cellLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.background },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, marginTop: spacing.lg, textAlign: 'center' },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
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
  spinButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    minWidth: 180,
    alignItems: 'center',
  },
  spinButtonDisabled: { opacity: 0.6 },
  spinButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
