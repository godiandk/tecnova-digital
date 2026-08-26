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
import { fetchPokerConfig, newPokerHand, actPoker, PokerConfig, PokerHandState, PokerCard, PokerAction } from '../../api/poker';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Poker'>;

const BUY_IN_STEP = 100;
const SUIT_SYMBOL: Record<string, string> = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };
const STREET_LABEL: Record<string, string> = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' };
const ACTION_LABEL: Record<PokerAction, string> = { desistir: 'Desistir', passar: 'Passar', pagar: 'Pagar', aumentar: 'Aumentar' };

function rankLabel(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

function cardLabel(card: PokerCard): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

function Hand({ cards }: { cards: PokerCard[] }) {
  return (
    <View style={styles.cardRow}>
      {cards.map((card, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.cardLabel}>{cardLabel(card)}</Text>
        </View>
      ))}
    </View>
  );
}

export function PokerScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('poker');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<PokerConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [buyIn, setBuyIn] = useState(1000);
  const [hand, setHand] = useState<PokerHandState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchPokerConfig()
      .then((data) => {
        setConfig(data);
        setBuyIn(Math.max(data.minBuyIn, Math.min(1000, data.maxBuyIn)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const run = async (action: () => Promise<PokerHandState>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      setHand(result);
      setBalance(result.newBalance);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Não foi possível completar a ação agora.');
    } finally {
      setBusy(false);
    }
  };

  const adjustBuyIn = (delta: number) => {
    if (!config) return;
    setBuyIn((current) => Math.max(config.minBuyIn, Math.min(config.maxBuyIn, current + delta)));
  };

  const inHand = Boolean(hand && !hand.finished);

  return (
    <GameBackdrop source={TABLE_IMAGES.poker}>
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
          <DealerBadge source={DEALER_IMAGES.poker} />
          <Text style={styles.title}>Pôquer</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && !inHand && (
          <View style={styles.startBlock}>
            {hand?.finished && hand.outcome && (
              <View style={styles.showdownBlock}>
                <Text style={[styles.resultLabel, hand.outcome.winner === 'jogador' ? styles.resultWin : hand.outcome.winner === 'bot' ? styles.resultLoss : styles.resultDraw]}>
                  {hand.outcome.winner === 'jogador'
                    ? `Você ganhou ${hand.outcome.potWon.toLocaleString('pt-BR')} fichas!`
                    : hand.outcome.winner === 'bot'
                      ? 'O bot levou a mão.'
                      : 'Empate — pote dividido.'}
                </Text>
                {hand.outcome.playerHandLabel && (
                  <Text style={styles.handLabelText}>
                    Você: {hand.outcome.playerHandLabel} · Bot: {hand.outcome.botHandLabel}
                  </Text>
                )}
                <View style={styles.showdownHands}>
                  <View>
                    <Text style={styles.playedLabel}>Sua mão</Text>
                    <Hand cards={hand.outcome.playerHole} />
                  </View>
                  <View>
                    <Text style={styles.playedLabel}>Mão do bot</Text>
                    <Hand cards={hand.outcome.botHole} />
                  </View>
                </View>
              </View>
            )}
            <View style={styles.betRow}>
              <Pressable onPress={() => adjustBuyIn(-BUY_IN_STEP)} style={styles.betButton} disabled={busy}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Buy-in (cegas {config.smallBlind}/{config.bigBlind})</Text>
                <Text style={styles.betAmount}>{buyIn.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustBuyIn(BUY_IN_STEP)} style={styles.betButton} disabled={busy}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}
            <Pressable onPress={() => run(() => newPokerHand(buyIn))} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Começar mão</Text>}
            </Pressable>
          </View>
        )}

        {inHand && hand && (
          <View style={styles.matchBlock}>
            <Text style={styles.score}>
              {STREET_LABEL[hand.street]} · Pote {hand.pot.toLocaleString('pt-BR')}
            </Text>
            <Text style={styles.stacksText}>
              Você: {hand.playerStack.toLocaleString('pt-BR')} · Bot: {hand.botStack.toLocaleString('pt-BR')}
            </Text>

            <Text style={styles.playedLabel}>Mesa</Text>
            {hand.board.length > 0 ? (
              <Hand cards={hand.board} />
            ) : (
              <Text style={styles.placeholderText}>Nenhuma carta comunitária ainda</Text>
            )}

            <Text style={[styles.playedLabel, { marginTop: spacing.lg }]}>Sua mão</Text>
            <Hand cards={hand.playerHole} />

            {hand.lastEvent && <Text style={styles.eventText}>{hand.lastEvent}</Text>}
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            <View style={styles.actionRow}>
              {hand.legalActions.map((action) => (
                <Pressable
                  key={action}
                  onPress={() => run(() => actPoker(action))}
                  disabled={busy}
                  style={[action === 'aumentar' ? styles.primaryButton : styles.secondaryButton, busy && styles.buttonDisabled]}
                >
                  <Text style={action === 'aumentar' ? styles.primaryButtonLabel : styles.secondaryButtonLabel}>{ACTION_LABEL[action]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </SafeAreaView>

      <TutorialModal visible={tutorialVisible} gameName="Pôquer" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  startBlock: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  showdownBlock: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  showdownHands: { flexDirection: 'row', gap: spacing.xxxl, marginTop: spacing.sm },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, textAlign: 'center', maxWidth: 300 },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  resultDraw: { color: colors.textSecondary },
  handLabelText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
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
  betValue: { alignItems: 'center', minWidth: 200 },
  betLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  matchBlock: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  score: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  stacksText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  placeholderText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint },
  playedLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.sm },
  cardRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.xs },
  card: {
    width: 48,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  cardLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.background },
  eventText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright, textAlign: 'center', maxWidth: 300, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', marginTop: spacing.lg },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 130,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.feltLine,
    minWidth: 130,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  secondaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
});
