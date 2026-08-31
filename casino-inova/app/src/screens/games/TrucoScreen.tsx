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
import { Carta } from '../../components/Carta';
import { ApiError } from '../../api/client';
import {
  fetchTrucoConfig,
  newTrucoMatch,
  playTrucoCard,
  callTruco,
  respondTruco,
  TrucoConfig,
  TrucoMatchState,
  TrucoCard,
  TrucoVariantRules,
} from '../../api/truco';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Truco'>;

const BUY_IN_STEP = 100;

/** Largura da carta. Três na mão e duas na mesa, num celular estreito. */
const LARGURA_DA_CARTA = 62;

/** A vira é referência, não carta de jogar: entra menor pra não competir com a mão. */
const LARGURA_DA_VIRA = 40;

/**
 * A escada de aumento vem da variante, nunca fixa aqui. Paulista sobe 1 → 3 → 6 → 9 → 12
 * e mineiro sobe 2 → 4 → 6 → 10 → 12, com nomes diferentes no mesmo degrau — uma escada
 * chumbada na tela deixava o mineiro sem o botão de aumentar.
 */
function nomeDoPedido(regras: TrucoVariantRules | undefined, valor: number | null): string {
  if (valor === null) return '';
  return regras?.raiseLabel[String(valor)] ?? String(valor);
}

/** Próximo degrau depois de `valor` — 0 quando já está no topo, pra cair no `&&` do JSX. */
function proximoDegrau(regras: TrucoVariantRules | undefined, valor: number): number {
  const escada = regras?.handValueLadder ?? [];
  const posicao = escada.indexOf(valor);
  return posicao === -1 || posicao === escada.length - 1 ? 0 : escada[posicao + 1];
}

/** O nome da imagem da carta — 'espadas-A', 'copas-7'. */
function nomeDaCarta(card: TrucoCard): string {
  return `${card.suit}-${card.rank}`;
}

export function TrucoScreen({ navigation, route }: Props) {
  /** Variante escolhida na tela anterior; sem ela, cai no padrão do servidor. */
  const variante = route.params?.variant ?? 'paulista';
  const tutorial = getTutorialByGameId('truco');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<TrucoConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [buyIn, setBuyIn] = useState(200);
  const [match, setMatch] = useState<TrucoMatchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrucoConfig()
      .then((data) => {
        setConfig(data);
        setBuyIn(Math.max(data.minBuyIn, Math.min(200, data.maxBuyIn)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const run = async (action: () => Promise<TrucoMatchState>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      setMatch(result);
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

  const inMatch = Boolean(match && !match.finished);
  const awaitingBotTruco = match?.pendingTruco === 'bot';
  /** A variante que está valendo agora: a da partida em andamento, ou a escolhida na tela anterior. */
  const regrasDaVariante = config?.variants[match?.variant ?? variante];

  return (
    <GameBackdrop source={TABLE_IMAGES.truco}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <View style={styles.topActions}>
            <Pressable onPress={() => navigation.navigate('TrucoMesa')} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="people" size={22} color={colors.goldBright} />
            </Pressable>
            <Pressable onPress={() => setTutorialVisible(true)} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="help-circle" size={24} color={colors.goldBright} />
            </Pressable>
          </View>
        </View>

        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.trucoDomino} />
          <Text style={styles.title}>Truco</Text>
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
              <Text style={[styles.resultLabel, match.matchOutcome === 'jogador' ? styles.resultWin : styles.resultLoss]}>
                {match.matchOutcome === 'jogador' ? `Você venceu a partida ${match.playerScore} a ${match.botScore}!` : `O bot venceu ${match.botScore} a ${match.playerScore}.`}
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
            <Pressable onPress={() => run(() => newTrucoMatch(buyIn, variante))} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Começar partida</Text>}
            </Pressable>
          </View>
        )}

        {inMatch && match && (
          <View style={styles.matchBlock}>
            <Text style={styles.score}>
              Você {match.playerScore} × {match.botScore} Bot · mão vale {match.handValue}
            </Text>
            {/* Paulista mostra a vira; mineiro não tem vira, as manilhas são fixas. */}
            {match.vira ? (
              <View style={styles.viraLinha}>
                <Text style={styles.vira}>Vira</Text>
                <Carta carta={nomeDaCarta(match.vira)} largura={LARGURA_DA_VIRA} truco />
              </View>
            ) : (
              <Text style={styles.vira}>Mineiro · manilhas fixas: 4♣ 7♥ A♠ 7♦</Text>
            )}

            {match.lastEvent && <Text style={styles.eventText}>{match.lastEvent}</Text>}

            <View style={styles.playedRow}>
              <View style={styles.playedSlot}>
                <Text style={styles.playedLabel}>Bot</Text>
                {match.botCardsPlayed.length > 0 ? (
                  <Carta
                    carta={nomeDaCarta(match.botCardsPlayed[match.botCardsPlayed.length - 1])}
                    largura={LARGURA_DA_CARTA}
                    truco
                  />
                ) : (
                  <View style={styles.vagaVazia} />
                )}
              </View>
              <View style={styles.playedSlot}>
                <Text style={styles.playedLabel}>Você</Text>
                {match.playerCardsPlayed.length > 0 ? (
                  <Carta
                    carta={nomeDaCarta(match.playerCardsPlayed[match.playerCardsPlayed.length - 1])}
                    largura={LARGURA_DA_CARTA}
                    truco
                  />
                ) : (
                  <View style={styles.vagaVazia} />
                )}
              </View>
            </View>

            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {awaitingBotTruco ? (
              <>
                {/* Na mesa o pedido é cantado antes da resposta — quem responde precisa
                    saber por quanto está respondendo, não só que existe um pedido. */}
                <Text style={styles.pedidoDaMesa}>
                  Bot pediu {nomeDoPedido(regrasDaVariante, match.pendingHandValue).toUpperCase()}! · a mão passa a
                  valer {match.pendingHandValue}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => run(() => respondTruco('correr'))}
                    disabled={busy}
                    style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                  >
                    <Text style={styles.secondaryButtonLabel}>Não quero</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => run(() => respondTruco('aceitar'))}
                    disabled={busy}
                    style={[styles.primaryButton, busy && styles.buttonDisabled]}
                  >
                    <Text style={styles.primaryButtonLabel}>Quero</Text>
                  </Pressable>
                  {match.pendingHandValue !== null && proximoDegrau(regrasDaVariante, match.pendingHandValue) > 0 && (
                    <Pressable
                      onPress={() => run(() => respondTruco('aumentar'))}
                      disabled={busy}
                      style={[styles.primaryButton, busy && styles.buttonDisabled]}
                    >
                      <Text style={styles.primaryButtonLabel}>
                        {nomeDoPedido(regrasDaVariante, proximoDegrau(regrasDaVariante, match.pendingHandValue)).toUpperCase()}!
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.handRow}>
                  {match.playerHand.map((card, index) => (
                    <Pressable
                      key={`${card.rank}-${card.suit}-${index}`}
                      onPress={() => run(() => playTrucoCard(card))}
                      disabled={busy}
                    >
                      <Carta carta={nomeDaCarta(card)} indice={index} largura={LARGURA_DA_CARTA} truco />
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => run(callTruco)}
                  disabled={busy || match.nextRaiseValue === null}
                  style={[styles.secondaryButton, (busy || match.nextRaiseValue === null) && styles.buttonDisabled]}
                >
                  <Text style={styles.secondaryButtonLabel}>
                    {match.nextRaiseValue ? `${nomeDoPedido(regrasDaVariante, match.nextRaiseValue).toUpperCase()}!` : 'Não dá pra aumentar'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </SafeAreaView>

      <TutorialModal visible={tutorialVisible} gameName="Truco" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  pedidoDaMesa: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  safe: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.sm,
  },
  topActions: { flexDirection: 'row', gap: spacing.xs },
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
  matchBlock: { width: '100%', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  score: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  viraLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vira: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  eventText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.goldBright,
    textAlign: 'center',
    maxWidth: 300,
  },
  playedRow: { flexDirection: 'row', gap: spacing.xxxl, marginTop: spacing.sm },
  /* A vaga da carta ainda não jogada: o mesmo tamanho da carta, só que vazia. */
  vagaVazia: {
    width: LARGURA_DA_CARTA,
    height: Math.round(LARGURA_DA_CARTA * 1.5),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.feltLine,
  },
  playedSlot: { alignItems: 'center', gap: spacing.xs },
  playedLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  handRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
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
    marginTop: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.feltLine,
    minWidth: 140,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  secondaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
});
