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
import {
  fetchDominoConfig,
  newDominoMatch,
  playDominoTile,
  passDominoTurn,
  DominoConfig,
  DominoMatchState,
  DominoTile,
  DominoEnd,
} from '../../api/domino';
import { mockPlayer } from '../../data/mockPlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Domino'>;

const BUY_IN_STEP = 100;

function tileLabel(tile: DominoTile): string {
  return `${tile.a}|${tile.b}`;
}

function tileMatches(tile: DominoTile, value: number): boolean {
  return tile.a === value || tile.b === value;
}

export function DominoScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('domino');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<DominoConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(mockPlayer.chipBalance);
  const [buyIn, setBuyIn] = useState(200);
  const [match, setMatch] = useState<DominoMatchState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchDominoConfig()
      .then((data) => {
        setConfig(data);
        setBuyIn(Math.max(data.minBuyIn, Math.min(200, data.maxBuyIn)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const run = async (action: () => Promise<DominoMatchState>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      setMatch(result);
      setBalance(result.newBalance);
      setSelectedIndex(null);
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

  const inMatch = Boolean(match && !match.finished);
  const selectedTile = selectedIndex !== null && match ? match.playerHand[selectedIndex] : null;
  const boardEmpty = match?.leftEnd === null;
  const matchesLeft = selectedTile && !boardEmpty && match ? tileMatches(selectedTile, match.leftEnd!) : false;
  const matchesRight = selectedTile && !boardEmpty && match ? tileMatches(selectedTile, match.rightEnd!) : false;

  const playSelected = (end?: DominoEnd) => {
    if (!selectedTile) return;
    run(() => playDominoTile(selectedTile, end));
  };

  return (
    <GameBackdrop source={TABLE_IMAGES.domino}>
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
          <DealerBadge source={DEALER_IMAGES.trucoDomino} />
          <Text style={styles.title}>Dominó</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && !inMatch && (
          <View style={styles.startBlock}>
            {match?.finished && (
              <Text
                style={[
                  styles.resultLabel,
                  match.matchOutcome === 'jogador' ? styles.resultWin : match.matchOutcome === 'bot' ? styles.resultLoss : styles.resultDraw,
                ]}
              >
                {match.matchOutcome === 'jogador' ? 'Você venceu a partida!' : match.matchOutcome === 'bot' ? 'O bot venceu.' : 'Empate — buy-in devolvido.'}
              </Text>
            )}
            <View style={styles.betRow}>
              <Pressable onPress={() => adjustBuyIn(-BUY_IN_STEP)} style={styles.betButton} disabled={busy}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.betValue}>
                <Text style={styles.betLabel}>Buy-in (paga ×2 se ganhar)</Text>
                <Text style={styles.betAmount}>{buyIn.toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable onPress={() => adjustBuyIn(BUY_IN_STEP)} style={styles.betButton} disabled={busy}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}
            <Pressable onPress={() => run(() => newDominoMatch(buyIn))} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Começar partida</Text>}
            </Pressable>
          </View>
        )}

        {inMatch && match && (
          <View style={styles.matchBlock}>
            <Text style={styles.score}>Peças do bot: {match.botTileCount}</Text>
            <Text style={styles.boardEnds}>
              {boardEmpty ? 'Mesa vazia — escolha uma peça pra abrir' : `Pontas: ${match.leftEnd} — ${match.rightEnd}`}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boardScroll} contentContainerStyle={styles.boardRow}>
              {match.boardTiles.map((tile, index) => (
                <View key={index} style={styles.boardTile}>
                  <Text style={styles.boardTileLabel}>{tileLabel(tile)}</Text>
                </View>
              ))}
            </ScrollView>

            {match.lastEvent && <Text style={styles.eventText}>{match.lastEvent}</Text>}
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {selectedTile && !boardEmpty && (
              <View style={styles.endRow}>
                <Pressable onPress={() => playSelected('esquerda')} disabled={!matchesLeft || busy} style={[styles.secondaryButton, (!matchesLeft || busy) && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonLabel}>Jogar à esquerda</Text>
                </Pressable>
                <Pressable onPress={() => playSelected('direita')} disabled={!matchesRight || busy} style={[styles.secondaryButton, (!matchesRight || busy) && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonLabel}>Jogar à direita</Text>
                </Pressable>
              </View>
            )}
            {selectedTile && boardEmpty && (
              <Pressable onPress={() => playSelected()} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
                <Text style={styles.primaryButtonLabel}>Abrir com essa peça</Text>
              </Pressable>
            )}

            <View style={styles.handRow}>
              {match.playerHand.map((tile, index) => (
                <Pressable
                  key={index}
                  onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                  disabled={busy}
                  style={[styles.card, index === selectedIndex && styles.cardSelected]}
                >
                  <Text style={styles.cardLabel}>{tileLabel(tile)}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => run(passDominoTurn)}
              disabled={busy || match.canPlay}
              style={[styles.secondaryButton, (busy || match.canPlay) && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonLabel}>Passar a vez</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <TutorialModal visible={tutorialVisible} gameName="Dominó" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
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
  startBlock: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxxl },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, textAlign: 'center', maxWidth: 280 },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  resultDraw: { color: colors.textSecondary },
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
  betValue: { alignItems: 'center', minWidth: 180 },
  betLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  matchBlock: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  score: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  boardEnds: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  boardScroll: { width: '100%', maxHeight: 60, marginTop: spacing.xs },
  boardRow: { gap: spacing.xs, paddingHorizontal: spacing.md },
  boardTile: {
    minWidth: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  boardTileLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textSecondary },
  eventText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright, textAlign: 'center', maxWidth: 300 },
  endRow: { flexDirection: 'row', gap: spacing.md },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.md },
  card: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: colors.goldBright },
  cardLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.background },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    minWidth: 180,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.feltLine,
    minWidth: 140,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  secondaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
});
