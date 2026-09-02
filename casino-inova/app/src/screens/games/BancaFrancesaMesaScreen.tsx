import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { TABLE_IMAGES } from '../../data/tableImages';
import { PLAYER_CHIP_IMAGES, PLAYER_COLOR_LABELS } from '../../data/chipImages';
import { GameBackdrop } from '../../components/GameBackdrop';
import { CasinoCard } from '../../components/CasinoCard';
import { ChatPanel } from '../../components/ChatPanel';
import { ApiError } from '../../api/client';
import { usuarioLogadoId } from '../../api/session';
import { SocketError } from '../../api/socket';
import { BancaFrancesaBetType } from '../../api/bancaFrancesa';
import { fetchFriends, Friend } from '../../api/friends';
import {
  addBot,
  createTable,
  inviteFriend,
  joinByCode,
  joinById,
  leaveTable,
  listPublicTables,
  onTableClosed,
  onTableUpdated,
  placeBets,
  roll,
  PublicTableSummary,
  TableView,
} from '../../api/bancaFrancesaMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesaMesa'>;

const BET_STEP = 50;
const DEFAULT_BET = 100;

const BET_OPTIONS: { type: BancaFrancesaBetType; label: string; hint: string }[] = [
  { type: 'pequeno', label: 'Pequeno', hint: '5, 6 ou 7' },
  { type: 'grande', label: 'Grande', hint: '14, 15 ou 16' },
  { type: 'ases', label: 'Ases', hint: 'soma 3' },
  { type: 'linha', label: 'Linha', hint: 'meio a meio' },
];

const OUTCOME_LABEL: Record<string, string> = { ases: 'Ases', pequeno: 'Pequeno', grande: 'Grande' };

function errorMessage(error: unknown): string {
  if (error instanceof SocketError || error instanceof ApiError) return error.message;
  return 'Não foi possível falar com o servidor.';
}

export function BancaFrancesaMesaScreen({ navigation }: Props) {
  const [table, setTable] = useState<TableView | null>(null);
  const [publicTables, setPublicTables] = useState<PublicTableSummary[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [amountPerBet, setAmountPerBet] = useState(DEFAULT_BET);
  const [selected, setSelected] = useState<Set<BancaFrancesaBetType>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isHost = table?.hostUserId === usuarioLogadoId();

  const refreshPublic = useCallback(async () => {
    try {
      setPublicTables(await listPublicTables());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    refreshPublic();
    fetchFriends().then(setFriends).catch(() => undefined);
  }, [refreshPublic]);

  useEffect(() => {
    const offUpdate = onTableUpdated((updated) => {
      setTable((current) => (current && current.id === updated.id ? updated : current));
    });
    const offClosed = onTableClosed(() => {
      setTable(null);
      setNotice('A mesa foi fechada — o anfitrião saiu.');
    });
    return () => {
      offUpdate();
      offClosed();
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
      setTable(await createTable(visibility));
      setNotice(null);
    });

  const handleJoinCode = () =>
    run(async () => {
      if (!codeInput.trim()) return;
      setTable(await joinByCode(codeInput.trim()));
      setCodeInput('');
      setNotice(null);
    });

  const handleJoinId = (tableId: string) =>
    run(async () => {
      setTable(await joinById(tableId));
      setNotice(null);
    });

  const handleInvite = (friendUserId: string) =>
    run(async () => {
      if (!table) return;
      const result = await inviteFriend(table.id, friendUserId);
      setNotice(
        result.enviado
          ? result.amigoOnline
            ? 'Convite enviado — a pessoa recebeu agora.'
            : 'Convite registrado, mas a pessoa está offline.'
          : result.motivo ?? 'Não deu pra convidar.',
      );
    });

  const handleAddBot = () =>
    run(async () => {
      if (table) setTable(await addBot(table.id));
    });

  const handlePlaceBets = () =>
    run(async () => {
      if (!table || selected.size === 0) return;
      const bets = Array.from(selected).map((type) => ({ type, amount: amountPerBet }));
      setTable(await placeBets(table.id, bets));
      setNotice('Aposta registrada — esperando o anfitrião girar.');
    });

  const handleRoll = () =>
    run(async () => {
      if (table) {
        setTable(await roll(table.id));
        setSelected(new Set());
        setNotice(null);
      }
    });

  const handleLeave = () =>
    run(async () => {
      if (!table) return;
      await leaveTable(table.id);
      setTable(null);
      setSelected(new Set());
      setNotice(null);
      refreshPublic();
    });

  const toggleBet = (type: BancaFrancesaBetType) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <GameBackdrop source={TABLE_IMAGES['banca-francesa']}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Mesa online</Text>
          <View style={styles.iconButton} />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {notice && <Text style={styles.noticeText}>{notice}</Text>}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!table ? (
            <>
              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Criar uma mesa</Text>
                <Text style={styles.cardHint}>Até 15 pessoas na mesma mesa — cada uma com uma cor de ficha.</Text>
                <View style={styles.buttonRow}>
                  <Pressable onPress={() => handleCreate('publica')} style={styles.primaryButton} disabled={busy}>
                    <Text style={styles.primaryLabel}>Mesa pública</Text>
                  </Pressable>
                  <Pressable onPress={() => handleCreate('privada')} style={styles.secondaryButton} disabled={busy}>
                    <Text style={styles.secondaryLabel}>Mesa privada</Text>
                  </Pressable>
                </View>
              </CasinoCard>

              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Entrar com código</Text>
                <Text style={styles.cardHint}>Peça o código de 6 caracteres pra quem criou a mesa privada.</Text>
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
                {publicTables.length === 0 && <Text style={styles.cardHint}>Nenhuma mesa pública aberta agora.</Text>}
                {publicTables.map((item) => (
                  <Pressable key={item.id} onPress={() => handleJoinId(item.id)} style={styles.publicRow} disabled={busy}>
                    <View>
                      <Text style={styles.publicHost}>Mesa de {item.hostName}</Text>
                      <Text style={styles.cardHint}>
                        {item.seatedCount} de {item.maxSeats} lugares
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

                {table.lastRound && (
                  <View style={styles.roundBox}>
                    <View style={styles.diceRow}>
                      {table.lastRound.dice.map((die, index) => (
                        <View key={index} style={styles.die}>
                          <Text style={styles.dieLabel}>{die}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.outcomeLabel}>
                      Soma {table.lastRound.sum} → {OUTCOME_LABEL[table.lastRound.outcome]}
                    </Text>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Na mesa ({table.seats.length}/15)</Text>
                {table.seats.map((seat) => {
                  const round = table.lastRound?.bySeat[seat.userId];
                  return (
                    <View key={seat.userId} style={styles.seatRow}>
                      <Image source={PLAYER_CHIP_IMAGES[seat.color]} style={styles.chip} resizeMode="contain" />
                      <View style={styles.seatInfo}>
                        <Text style={styles.seatName}>
                          {seat.name}
                          {seat.userId === usuarioLogadoId() ? ' (você)' : ''}
                          {seat.userId === table.hostUserId ? ' · anfitrião' : ''}
                        </Text>
                        <Text style={styles.seatMeta}>
                          {PLAYER_COLOR_LABELS[seat.color]}
                          {seat.isBot ? ' · bot' : seat.balance !== undefined ? ` · ${seat.balance.toLocaleString('pt-BR')} fichas` : ''}
                        </Text>
                      </View>
                      {round && (
                        <Text style={[styles.seatResult, round.totalReturn > round.totalStake && styles.seatResultWin]}>
                          {round.totalReturn > 0 ? `+${round.totalReturn.toLocaleString('pt-BR')}` : `−${round.totalStake.toLocaleString('pt-BR')}`}
                        </Text>
                      )}
                      {!round && seat.pendingBets.length > 0 && <Text style={styles.seatPending}>apostou</Text>}
                    </View>
                  );
                })}
              </CasinoCard>

              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Sua aposta</Text>
                <View style={styles.betGrid}>
                  {BET_OPTIONS.map((option) => (
                    <Pressable
                      key={option.type}
                      onPress={() => toggleBet(option.type)}
                      style={[styles.betTile, selected.has(option.type) && styles.betTileSelected]}
                      disabled={busy}
                    >
                      <Text style={styles.betLabel}>{option.label}</Text>
                      <Text style={styles.cardHint}>{option.hint}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.amountRow}>
                  <Pressable
                    onPress={() => setAmountPerBet((value) => Math.max(BET_STEP, value - BET_STEP))}
                    style={styles.stepButton}
                    disabled={busy}
                  >
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.amountLabel}>{amountPerBet.toLocaleString('pt-BR')} por aposta</Text>
                  <Pressable onPress={() => setAmountPerBet((value) => value + BET_STEP)} style={styles.stepButton} disabled={busy}>
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={handlePlaceBets}
                  style={[styles.primaryButton, (busy || selected.size === 0) && styles.buttonDisabled]}
                  disabled={busy || selected.size === 0}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text style={styles.primaryLabel}>Apostar {(amountPerBet * selected.size).toLocaleString('pt-BR')}</Text>
                  )}
                </Pressable>
              </CasinoCard>

              {isHost && (
                <CasinoCard style={styles.card}>
                  <Text style={styles.cardTitle}>Controles do anfitrião</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={handleAddBot} style={styles.secondaryButton} disabled={busy}>
                      <Text style={styles.secondaryLabel}>Completar com bot</Text>
                    </Pressable>
                    <Pressable onPress={handleRoll} style={styles.primaryButton} disabled={busy}>
                      <Text style={styles.primaryLabel}>Girar</Text>
                    </Pressable>
                  </View>

                  {/* Chat só aparece pra quem está sentado numa mesa. */}
                  {friends.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Convidar amigo</Text>
                      {friends.map((friend) => (
                        <Pressable
                          key={friend.userId}
                          onPress={() => handleInvite(friend.userId)}
                          style={styles.publicRow}
                          disabled={busy}
                        >
                          <Text style={styles.publicHost}>{friend.name}</Text>
                          <Ionicons name="add-circle" size={22} color={colors.goldBright} />
                        </Pressable>
                      ))}
                    </>
                  )}
                </CasinoCard>
              )}

              {/* Chat da mesa — todo mundo sentado conversa aqui. */}
              <ChatPanel roomId={table.id} scope="mesa" />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GameBackdrop>
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
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
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
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.background },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.felt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  buttonDisabled: { opacity: 0.6 },
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
  roundBox: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  diceRow: { flexDirection: 'row', gap: spacing.sm },
  die: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  dieLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: colors.background },
  outcomeLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.goldBright },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { width: 32, height: 32 },
  seatInfo: { flex: 1 },
  seatName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  seatMeta: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  seatResult: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.danger },
  seatResultWin: { color: colors.success },
  seatPending: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.goldBright },
  betGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  betTile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.feltLine,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  betTileSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  betLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary, minWidth: 150, textAlign: 'center' },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  noticeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.goldBright, textAlign: 'center', marginTop: spacing.sm },
});
