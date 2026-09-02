import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { ChipStack } from '../../components/ChipStack';
import { ApiError } from '../../api/client';
import {
  fetchStockMarketConfig,
  fetchStockMarketHistory,
  playStockMarketRound,
  StockDirection,
  StockMarketConfig,
  StockMarketRoundResponse,
} from '../../api/stockMarket';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StockMarket'>;

const BET_STEP = 50;
const CHART_HEIGHT = 160;

export function StockMarketScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('stock-market');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<StockMarketConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [amount, setAmount] = useState(100);
  const [direction, setDirection] = useState<StockDirection | null>(null);
  const [round, setRound] = useState<StockMarketRoundResponse | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    fetchStockMarketConfig()
      .then((data) => {
        setConfig(data);
        setAmount(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
    fetchStockMarketHistory().then((data) => setHistory(data.closes)).catch(() => undefined);
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmount((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const handlePlay = async () => {
    if (!config || playing || !direction) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const result = await playStockMarketRound(direction, amount);
      setRound(result);
      setBalance(result.newBalance);
      setHistory((current) => [...current, result.closePercent].slice(-30));
    } catch (error) {
      setPlayError(error instanceof ApiError ? error.message : 'Não foi possível apostar agora.');
    } finally {
      setPlaying(false);
    }
  };

  const won = round ? round.totalReturn > round.amount : false;

  return (
    <GameBackdrop source={TABLE_IMAGES['stock-market']}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <Pressable onPress={() => setTutorialVisible(true)} accessibilityRole="button" accessibilityLabel="Como jogar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Stock Market</Text>

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
                RTP divulgado: {(config.theoreticalRtp * 100).toFixed(0)}% · comissão de{' '}
                {(config.commission * 100).toFixed(0)}% sobre o que você recebe
              </Text>

              <PriceChart path={round?.path} closePercent={round?.closePercent} />

              {round && (
                <Text style={[styles.closeLabel, { color: round.closePercent >= 0 ? colors.success : colors.ruby }]}>
                  Fechou em {round.closePercent > 0 ? '+' : ''}
                  {round.closePercent.toFixed(2)}%
                </Text>
              )}

              <View style={styles.directionRow}>
                <DirectionButton
                  label="ALTA"
                  icon="trending-up"
                  active={direction === 'alta'}
                  accent={colors.success}
                  onPress={() => setDirection('alta')}
                  disabled={playing}
                />
                <DirectionButton
                  label="BAIXA"
                  icon="trending-down"
                  active={direction === 'baixa'}
                  accent={colors.ruby}
                  onPress={() => setDirection('baixa')}
                  disabled={playing}
                />
              </View>

              {round && (
                <View style={styles.receipt}>
                  <Text style={styles.receiptLine}>
                    Apostou {round.amount.toLocaleString('pt-BR')} em {round.direction === 'alta' ? 'ALTA' : 'BAIXA'}
                  </Text>
                  <Text style={styles.receiptLine}>
                    Retorno bruto {round.grossReturn.toFixed(2)} − comissão {round.commission.toFixed(2)}
                  </Text>
                  <Text style={[styles.receiptTotal, { color: won ? colors.success : colors.ruby }]}>
                    Você recebeu {round.totalReturn.toLocaleString('pt-BR')}
                  </Text>
                </View>
              )}

              {playError && <Text style={styles.errorText}>{playError}</Text>}

              <View style={styles.betRow}>
                <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.stepButton} disabled={playing}>
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.betValue}>
                  <Text style={styles.betValueLabel}>Sua aposta</Text>
                  <Text style={styles.betAmount}>{amount.toLocaleString('pt-BR')}</Text>
                </View>
                <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.stepButton} disabled={playing}>
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Pressable
                onPress={handlePlay}
                disabled={playing || !direction}
                style={[styles.primaryButton, (playing || !direction) && styles.buttonDisabled]}
              >
                {playing ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>
                    {direction ? `Investir ${amount.toLocaleString('pt-BR')}` : 'Escolha alta ou baixa'}
                  </Text>
                )}
              </Pressable>

              {history.length > 0 && (
                <View style={styles.historyPanel}>
                  <Text style={styles.historyLabel}>Rodadas anteriores</Text>
                  <View style={styles.historyRow}>
                    {history.slice(-20).map((close, index) => (
                      <View
                        key={index}
                        style={[
                          styles.historyDot,
                          { backgroundColor: close >= 0 ? colors.success : colors.ruby },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.disclaimer}>
                    Cada rodada é sorteada do zero — o que já saiu não muda a chance da próxima.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Stock Market"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

/**
 * Gráfico da cotação em barras verticais. Cada ponto do caminho vira uma coluna que
 * sai da linha do meio (o zero) pra cima ou pra baixo — dá pra ler a subida e a
 * descida sem precisar de biblioteca de gráfico.
 */
function PriceChart({ path, closePercent }: { path?: number[]; closePercent?: number }) {
  const points = path ?? [];
  const half = CHART_HEIGHT / 2;

  return (
    <View style={styles.chart}>
      <View style={styles.chartZeroLine} />
      <View style={styles.chartBars}>
        {points.length === 0 ? (
          <Text style={styles.chartEmpty}>Escolha um lado e invista pra ver a cotação andar.</Text>
        ) : (
          points.map((value, index) => {
            const magnitude = Math.min(Math.abs(value), 100) / 100;
            const height = Math.max(2, magnitude * half);
            const isUp = value >= 0;
            return (
              <View key={index} style={styles.chartColumn}>
                <View style={styles.chartHalf}>
                  {isUp && <View style={[styles.bar, { height, backgroundColor: colors.success }]} />}
                </View>
                <View style={styles.chartHalfBottom}>
                  {!isUp && <View style={[styles.bar, { height, backgroundColor: colors.ruby }]} />}
                </View>
              </View>
            );
          })
        )}
      </View>
      {closePercent !== undefined && (
        <Text style={styles.chartCaption}>
          {closePercent > 0 ? '+' : ''}
          {closePercent.toFixed(2)}%
        </Text>
      )}
    </View>
  );
}

function DirectionButton({
  label,
  icon,
  active,
  accent,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.directionButton, active && { borderColor: accent, backgroundColor: colors.felt }]}
    >
      <Ionicons name={icon} size={28} color={active ? accent : colors.textFaint} />
      <Text style={[styles.directionLabel, active && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: spacing.xxxl, gap: spacing.sm },
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
  chart: {
    height: CHART_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chartZeroLine: {
    position: 'absolute',
    top: CHART_HEIGHT / 2,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.goldDeep,
  },
  chartBars: { flexDirection: 'row', alignItems: 'stretch', height: '100%', paddingHorizontal: 4 },
  chartColumn: { flex: 1, marginHorizontal: 0.5 },
  chartHalf: { height: '50%', justifyContent: 'flex-end' },
  chartHalfBottom: { height: '50%', justifyContent: 'flex-start' },
  bar: { width: '100%', borderRadius: 1 },
  chartEmpty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    alignSelf: 'center',
    flex: 1,
    marginTop: CHART_HEIGHT / 2 - 8,
  },
  chartCaption: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  closeLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, textAlign: 'center' },
  directionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  directionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.backgroundElevated,
  },
  directionLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textFaint },
  receipt: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: 2,
  },
  receiptLine: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  receiptTotal: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, marginTop: 2 },
  betRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
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
  betValue: { alignItems: 'center', minWidth: 140 },
  betValueLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  historyPanel: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  historyLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  disclaimer: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, fontStyle: 'italic' },
});
