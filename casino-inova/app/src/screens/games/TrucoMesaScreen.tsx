import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { TABLE_IMAGES } from '../../data/tableImages';
import { GameBackdrop } from '../../components/GameBackdrop';
import { CasinoCard } from '../../components/CasinoCard';
import { ChatPanel } from '../../components/ChatPanel';
import { TRUCO_CARD_IMAGES, TRUCO_SIGNAL_IMAGES } from '../../data/gameAssets';
import { ApiError } from '../../api/client';
import { SocketError } from '../../api/socket';
import { fetchTrucoConfig, TrucoCard, TrucoConfig, TrucoStyle, TrucoVariant } from '../../api/truco';
import {
  addTrucoBot,
  callTrucoRaise,
  createTrucoTable,
  joinTrucoByCode,
  joinTrucoById,
  leaveTrucoTable,
  listPublicTrucoTables,
  onSignalReceived,
  onTrucoTableClosed,
  onTrucoTableUpdated,
  playTrucoTableCard,
  respondTrucoRaise,
  sendTableSignal,
  startTrucoMatch,
  TrucoPublicTable,
  TrucoTableView,
} from '../../api/trucoMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TrucoMesa'>;

const SUIT_SYMBOL: Record<string, string> = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };

function cardLabel(card: TrucoCard): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

/** A chave do baralho é "naipe-rank" — ver gameAssets.ts. */
function cardImage(card: TrucoCard): number | undefined {
  return TRUCO_CARD_IMAGES[`${card.suit}-${card.rank}`];
}

function errorMessage(error: unknown): string {
  if (error instanceof SocketError || error instanceof ApiError) return error.message;
  return 'Não foi possível falar com o servidor.';
}

export function TrucoMesaScreen({ navigation, route }: Props) {
  /** Variante escolhida na tela anterior — se veio de lá, já entra selecionada. */
  const variantePreescolhida = route.params?.variant;
  const [config, setConfig] = useState<TrucoConfig | null>(null);
  const [table, setTable] = useState<TrucoTableView | null>(null);
  const [publicTables, setPublicTables] = useState<TrucoPublicTable[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [variant, setVariant] = useState<TrucoVariant>('paulista');
  const [style, setStyle] = useState<TrucoStyle>('sujo');
  const [buyIn, setBuyIn] = useState(200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signalsOpen, setSignalsOpen] = useState(false);

  const me = table?.seats.find((seat) => seat.isYou);
  const isHost = table?.hostUserId === me?.userId;
  const isMyTurn = table?.started && me?.seatIndex === table.turnSeat;
  // Só a dupla adversária responde a um pedido — a regra vem do servidor, aqui só reflete.
  const mustRespond = Boolean(table?.pendingRaise && me && table.pendingRaise.byTeam !== me.team);

  const refreshPublic = useCallback(async () => {
    try {
      setPublicTables(await listPublicTrucoTables());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    fetchTrucoConfig()
      .then((data) => {
        setConfig(data);
        setVariant(variantePreescolhida ?? data.defaultVariant);
        setStyle(data.defaultStyle);
        setBuyIn(Math.max(data.minBuyIn, Math.min(200, data.maxBuyIn)));
      })
      .catch((caught) => setError(errorMessage(caught)));
    refreshPublic();
  }, [refreshPublic, variantePreescolhida]);

  useEffect(() => {
    const offUpdate = onTrucoTableUpdated((updated) => {
      setTable((current) => (current && current.id === updated.id ? updated : current));
    });
    const offClosed = onTrucoTableClosed(() => {
      setTable(null);
      setNotice('A mesa foi fechada.');
    });
    const offSignal = onSignalReceived((payload) => {
      // Chega só pra você: o adversário nunca recebe este evento.
      setNotice(`${payload.fromName} sinalizou: ${payload.signal.label} (${payload.signal.gesture})`);
    });
    return () => {
      offUpdate();
      offClosed();
      offSignal();
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (visibility: 'publica' | 'privada') =>
    run(async () => {
      setTable(await createTrucoTable({ visibility, variant, style, buyIn }));
      setNotice(null);
    });

  const handleJoinCode = () =>
    run(async () => {
      if (!codeInput.trim()) return;
      setTable(await joinTrucoByCode(codeInput.trim()));
      setCodeInput('');
      setNotice(null);
    });

  const handleLeave = () =>
    run(async () => {
      if (!table) return;
      await leaveTrucoTable(table.id);
      setTable(null);
      setNotice(null);
      refreshPublic();
    });

  const raiseLabel = (value: number) => config?.variants[variant]?.raiseLabel[String(value)] ?? String(value);

  return (
    <GameBackdrop source={TABLE_IMAGES.truco}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Truco online</Text>
          <View style={styles.iconButton} />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {notice && <Text style={styles.noticeText}>{notice}</Text>}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!table ? (
            <>
              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Criar mesa</Text>
                <Text style={styles.cardHint}>Truco é 2 contra 2 — precisa de 4 na mesa (dá pra completar com bot).</Text>

                <Text style={styles.optionLabel}>Variante</Text>
                <View style={styles.optionRow}>
                  <Toggle label="Paulista" active={variant === 'paulista'} onPress={() => setVariant('paulista')} />
                  <Toggle label="Mineiro" active={variant === 'mineiro'} onPress={() => setVariant('mineiro')} />
                </View>
                <Text style={styles.cardHint}>
                  {variant === 'paulista'
                    ? 'Manilha muda a cada mão (sai da vira). Mão começa valendo 1.'
                    : 'Manilhas fixas: 4♣ 7♥ A♠ 7♦. Sem vira. Mão começa valendo 2.'}
                </Text>

                <Text style={styles.optionLabel}>Estilo</Text>
                <View style={styles.optionRow}>
                  <Toggle label="Sujo" active={style === 'sujo'} onPress={() => setStyle('sujo')} />
                  <Toggle label="Limpo" active={style === 'limpo'} onPress={() => setStyle('limpo')} />
                </View>
                <Text style={styles.cardHint}>
                  {style === 'sujo' ? 'Pode mandar sinal pro parceiro.' : 'Sinal pro parceiro é proibido.'}
                </Text>

                <Text style={styles.optionLabel}>Buy-in</Text>
                <View style={styles.amountRow}>
                  <Pressable onPress={() => setBuyIn((v) => Math.max(config?.minBuyIn ?? 100, v - 100))} style={styles.stepButton}>
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.amountLabel}>{buyIn.toLocaleString('pt-BR')} fichas</Text>
                  <Pressable onPress={() => setBuyIn((v) => Math.min(config?.maxBuyIn ?? 5000, v + 100))} style={styles.stepButton}>
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable onPress={() => handleCreate('publica')} style={styles.primaryButton} disabled={busy}>
                    <Text style={styles.primaryLabel}>Pública</Text>
                  </Pressable>
                  <Pressable onPress={() => handleCreate('privada')} style={styles.secondaryButton} disabled={busy}>
                    <Text style={styles.secondaryLabel}>Privada</Text>
                  </Pressable>
                </View>
              </CasinoCard>

              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Entrar com código</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={codeInput}
                    onChangeText={setCodeInput}
                    placeholder="Ex: K7M2QP"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    style={styles.input}
                    editable={!busy}
                  />
                  <Pressable onPress={handleJoinCode} style={styles.primaryButton} disabled={busy}>
                    <Text style={styles.primaryLabel}>Entrar</Text>
                  </Pressable>
                </View>
              </CasinoCard>

              <CasinoCard style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Mesas públicas</Text>
                  <Pressable onPress={refreshPublic} hitSlop={12} disabled={busy}>
                    <Ionicons name="refresh" size={20} color={colors.goldBright} />
                  </Pressable>
                </View>
                {publicTables.length === 0 && <Text style={styles.cardHint}>Nenhuma mesa aberta agora.</Text>}
                {publicTables.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => run(async () => setTable(await joinTrucoById(item.id)))}
                    style={styles.publicRow}
                    disabled={busy}
                  >
                    <View>
                      <Text style={styles.publicHost}>Mesa de {item.hostName}</Text>
                      <Text style={styles.cardHint}>
                        {item.variant} · {item.style} · {item.seatedCount}/{item.maxSeats} · {item.buyIn} fichas
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                  </Pressable>
                ))}
              </CasinoCard>
            </>
          ) : (
            <>
              <CasinoCard style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {table.visibility === 'privada' ? `Código: ${table.code}` : 'Mesa pública'}
                  </Text>
                  <Pressable onPress={handleLeave} hitSlop={12} disabled={busy}>
                    <Text style={styles.leaveLabel}>Sair</Text>
                  </Pressable>
                </View>
                <Text style={styles.cardHint}>
                  {table.variant} · {table.style} · vale até {table.pointsToWin} pontos
                </Text>

                <View style={styles.scoreRow}>
                  <ScoreBox label="Nós (dupla A)" value={table.score.A} highlight={me?.team === 'A'} />
                  <ScoreBox label="Eles (dupla B)" value={table.score.B} highlight={me?.team === 'B'} />
                </View>

                {table.started && (
                  <Text style={styles.handValue}>
                    Mão vale {table.handValue}
                    {table.vira ? ` · vira ${cardLabel(table.vira)}` : ' · manilhas fixas'}
                  </Text>
                )}

                {table.lastEvent && <Text style={styles.eventText}>{table.lastEvent}</Text>}

                <Text style={styles.sectionLabel}>Na mesa</Text>
                {table.seats
                  .slice()
                  .sort((a, b) => a.seatIndex - b.seatIndex)
                  .map((seat) => (
                    <View key={seat.userId} style={styles.seatRow}>
                      <View style={[styles.teamDot, { backgroundColor: seat.team === 'A' ? colors.gold : colors.ruby }]} />
                      <Text style={styles.seatName}>
                        {seat.name}
                        {seat.isYou ? ' (você)' : seat.isPartner ? ' · seu parceiro' : ''}
                        {seat.isBot ? ' · bot' : ''}
                      </Text>
                      <Text style={styles.seatMeta}>
                        {table.started ? `${seat.cardsInHand} carta(s)` : 'aguardando'}
                        {table.started && seat.seatIndex === table.turnSeat ? ' · vez dele' : ''}
                      </Text>
                    </View>
                  ))}
              </CasinoCard>

              {!table.started ? (
                <CasinoCard style={styles.card}>
                  <Text style={styles.cardTitle}>Esperando jogadores ({table.seats.length}/4)</Text>
                  {isHost ? (
                    <View style={styles.buttonRow}>
                      <Pressable
                        onPress={() => run(async () => setTable(await addTrucoBot(table.id)))}
                        style={styles.secondaryButton}
                        disabled={busy || table.seats.length >= 4}
                      >
                        <Text style={styles.secondaryLabel}>Completar com bot</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => run(async () => setTable(await startTrucoMatch(table.id)))}
                        style={[styles.primaryButton, table.seats.length < 4 && styles.buttonDisabled]}
                        disabled={busy || table.seats.length < 4}
                      >
                        <Text style={styles.primaryLabel}>Começar</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.cardHint}>O anfitrião começa quando a mesa encher.</Text>
                  )}
                </CasinoCard>
              ) : (
                <>
                  <CasinoCard style={styles.card}>
                    <Text style={styles.sectionLabel}>Na rodada</Text>
                    <View style={styles.trickRow}>
                      {table.currentTrick.length === 0 && <Text style={styles.cardHint}>Ninguém jogou ainda.</Text>}
                      {table.currentTrick.map((play, index) => {
                        const seat = table.seats.find((item) => item.seatIndex === play.seatIndex);
                        return (
                          <View key={index} style={styles.trickCard}>
                            <Image source={cardImage(play.card)} style={styles.trickCardImage} resizeMode="contain" />
                            <Text style={styles.trickWho}>{seat?.name.split(' ')[0]}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </CasinoCard>

                  <CasinoCard style={styles.card}>
                    {mustRespond && table.pendingRaise ? (
                      <>
                        <Text style={styles.cardTitle}>
                          Pediram {raiseLabel(table.pendingRaise.toValue)}!
                        </Text>
                        <View style={styles.buttonRow}>
                          <Pressable
                            onPress={() => run(async () => setTable(await respondTrucoRaise(table.id, 'correr')))}
                            style={styles.secondaryButton}
                            disabled={busy}
                          >
                            <Text style={styles.secondaryLabel}>Correr</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => run(async () => setTable(await respondTrucoRaise(table.id, 'aceitar')))}
                            style={styles.primaryButton}
                            disabled={busy}
                          >
                            <Text style={styles.primaryLabel}>Aceitar</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => run(async () => setTable(await respondTrucoRaise(table.id, 'aumentar')))}
                            style={styles.primaryButton}
                            disabled={busy}
                          >
                            <Text style={styles.primaryLabel}>Aumentar</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.cardTitle}>
                          {isMyTurn ? 'Sua vez — escolha uma carta' : 'Esperando os outros...'}
                        </Text>
                        <View style={styles.handRow}>
                          {(me?.hand ?? []).map((card, index) => (
                            <Pressable
                              key={`${card.rank}-${card.suit}-${index}`}
                              onPress={() => run(async () => setTable(await playTrucoTableCard(table.id, card)))}
                              disabled={busy || !isMyTurn}
                              style={[styles.handCardWrap, !isMyTurn && styles.buttonDisabled]}
                            >
                              <Image source={cardImage(card)} style={styles.handCardImage} resizeMode="contain" />
                            </Pressable>
                          ))}
                        </View>

                        <View style={styles.buttonRow}>
                          <Pressable
                            onPress={() => run(async () => setTable(await callTrucoRaise(table.id)))}
                            style={[styles.secondaryButton, table.nextRaiseValue === null && styles.buttonDisabled]}
                            disabled={busy || table.nextRaiseValue === null}
                          >
                            <Text style={styles.secondaryLabel}>
                              {table.nextRaiseValue ? `Pedir ${raiseLabel(table.nextRaiseValue)}` : 'Não dá pra pedir'}
                            </Text>
                          </Pressable>
                          {table.style === 'sujo' && (
                            <Pressable onPress={() => setSignalsOpen((open) => !open)} style={styles.secondaryButton}>
                              <Text style={styles.secondaryLabel}>{signalsOpen ? 'Fechar sinais' : 'Sinal'}</Text>
                            </Pressable>
                          )}
                        </View>

                        {signalsOpen && config && (
                          <>
                            <Text style={styles.cardHint}>Só o seu parceiro vê o sinal.</Text>
                            <View style={styles.signalGrid}>
                              {config.signals.map((signal) => (
                                <Pressable
                                  key={signal.id}
                                  onPress={() =>
                                    run(async () => {
                                      await sendTableSignal(table.id, signal.id);
                                      setNotice(`Você sinalizou: ${signal.label}`);
                                      setSignalsOpen(false);
                                    })
                                  }
                                  style={styles.signalTile}
                                  disabled={busy}
                                >
                                  {TRUCO_SIGNAL_IMAGES[signal.id] && (
                                    <Image source={TRUCO_SIGNAL_IMAGES[signal.id]} style={styles.signalIcon} resizeMode="contain" />
                                  )}
                                  <View style={styles.signalText}>
                                    <Text style={styles.signalLabel}>{signal.label}</Text>
                                    <Text style={styles.signalGesture}>{signal.gesture}</Text>
                                  </View>
                                </Pressable>
                              ))}
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </CasinoCard>
                </>
              )}

              {/* Chat geral da mesa — o da dupla entra quando o servidor rotear por parceiro. */}
              <ChatPanel roomId={table.id} scope="mesa" comDupla />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GameBackdrop>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ScoreBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={[styles.scoreBox, highlight && styles.scoreBoxMine]}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
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
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  scroll: { gap: spacing.md, paddingVertical: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  cardHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  optionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
  },
  toggleActive: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  toggleLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textFaint },
  toggleLabelActive: { color: colors.textPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  amountLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary, minWidth: 120, textAlign: 'center' },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    letterSpacing: 2,
  },
  primaryButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.background },
  secondaryButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.felt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  buttonDisabled: { opacity: 0.5 },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.feltLine,
  },
  publicHost: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  leaveLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.danger },
  scoreRow: { flexDirection: 'row', gap: spacing.sm },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.backgroundElevated,
  },
  scoreBoxMine: { borderColor: colors.goldBright },
  scoreLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  scoreValue: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.lg, color: colors.textPrimary },
  handValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.goldBright, textAlign: 'center' },
  eventText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  seatName: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  seatMeta: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  trickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', minHeight: 60, alignItems: 'center' },
  trickCard: { alignItems: 'center', gap: 2 },
  trickWho: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  handRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  handCardWrap: { borderRadius: radius.sm, overflow: 'hidden' },
  handCardImage: { width: 58, height: 82 },
  trickCardImage: { width: 46, height: 64 },
  signalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  signalTile: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signalIcon: { width: 34, height: 34 },
  signalText: { flex: 1 },
  signalLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.textPrimary },
  signalGesture: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  noticeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.goldBright, textAlign: 'center', marginTop: spacing.sm },
});
