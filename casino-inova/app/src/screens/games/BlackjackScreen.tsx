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
import {
  fetchBlackjackConfig,
  startBlackjackHand,
  hitBlackjack,
  standBlackjack,
  BlackjackConfig,
  BlackjackHandResponse,
} from '../../api/blackjack';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Blackjack'>;

const BET_STEP = 50;

const OUTCOME_LABEL: Record<NonNullable<BlackjackHandResponse['outcome']>, string> = {
  'jogador-ganhou': 'Você ganhou!',
  'dealer-ganhou': 'A casa ganhou.',
  empate: 'Empate — sua aposta voltou.',
};

function Hand({ label, cards, total, hidden }: { label: string; cards: (string | null)[]; total?: number; hidden?: boolean }) {
  return (
    <View style={styles.handBlock}>
      <Text style={styles.handLabel}>
        {label}
        {total !== undefined ? ` · ${total}` : hidden ? ' · ?' : ''}
      </Text>
      <View style={styles.cardRow}>
        {cards.map((card, index) => (
          <View key={index} style={[styles.card, card === null && styles.cardHidden]}>
            <Text style={styles.cardLabel}>{card ?? '?'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function BlackjackScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('blackjack');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<BlackjackConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [bet, setBet] = useState(100);
  const [hand, setHand] = useState<BlackjackHandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchBlackjackConfig()
      .then((data) => {
        setConfig(data);
        setBet(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const inProgress = Boolean(hand && !hand.finished);

  const adjustBet = (delta: number) => {
    if (!config) return;
    setBet((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const runAction = async (action: () => Promise<BlackjackHandResponse>) => {
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

  return (
    <GameBackdrop source={TABLE_IMAGES.blackjack}>
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
          <DealerBadge source={DEALER_IMAGES.blackjack} />
          <Text style={styles.title}>Blackjack</Text>
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
              {hand ? (
                <>
                  <Hand label="Dealer" cards={hand.dealerCards} total={hand.dealerTotal} hidden={!hand.finished} />
                  <Hand label="Você" cards={hand.playerCards} total={hand.playerTotal} />
                </>
              ) : (
                <Text style={styles.placeholderText}>Aposte pra começar a mão.</Text>
              )}
            </View>

            {hand?.finished && hand.outcome && (
              <Text style={[styles.resultLabel, hand.outcome === 'jogador-ganhou' ? styles.resultWin : styles.resultLoss]}>
                {OUTCOME_LABEL[hand.outcome]}
                {hand.totalReturn ? ` +${hand.totalReturn.toLocaleString('pt-BR')} fichas` : ''}
              </Text>
            )}

            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {!inProgress && (
              <>
                <View style={styles.betRow}>
                  <Pressable onPress={() => adjustBet(-BET_STEP)} style={styles.betButton} disabled={busy}>
                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                  </Pressable>
                  <View style={styles.betValue}>
                    <Text style={styles.betLabel}>Aposta</Text>
                    <Text style={styles.betAmount}>{bet.toLocaleString('pt-BR')}</Text>
                  </View>
                  <Pressable onPress={() => adjustBet(BET_STEP)} style={styles.betButton} disabled={busy}>
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>
                <Pressable onPress={() => runAction(() => startBlackjackHand(bet))} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
                  {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Apostar</Text>}
                </Pressable>
              </>
            )}

            {inProgress && (
              <View style={styles.actionRow}>
                <Pressable onPress={() => runAction(hitBlackjack)} disabled={busy} style={[styles.secondaryButton, busy && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonLabel}>Pedir carta</Text>
                </Pressable>
                <Pressable onPress={() => runAction(standBlackjack)} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
                  {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Parar</Text>}
                </Pressable>
              </View>
            )}
          </>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Blackjack"
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  table: { width: '100%', marginTop: spacing.xl, gap: spacing.xl, minHeight: 220, justifyContent: 'center' },
  placeholderText: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.textFaint, textAlign: 'center' },
  handBlock: { gap: spacing.sm, alignItems: 'center' },
  handLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textSecondary },
  cardRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  card: {
    width: 52,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  cardHidden: { backgroundColor: colors.backgroundElevated, borderColor: colors.feltLine },
  cardLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: colors.background },
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
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    minWidth: 160,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  secondaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
});
