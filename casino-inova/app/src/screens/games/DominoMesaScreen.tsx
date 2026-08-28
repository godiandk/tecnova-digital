import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { TABLE_IMAGES } from '../../data/tableImages';
import { DOMINO_TILE_IMAGES } from '../../data/gameAssets';
import { GameBackdrop } from '../../components/GameBackdrop';
import { CasinoCard } from '../../components/CasinoCard';
import { MesaComLugares } from '../../components/MesaComLugares';
import { CorrenteDeDomino } from '../../components/CorrenteDeDomino';
import { ChatPanel } from '../../components/ChatPanel';
import { ApiError } from '../../api/client';
import { SocketError } from '../../api/socket';
import {
  addDominoBot,
  createDominoTable,
  DominoPublicTable,
  DominoTableView,
  joinDominoByCode,
  joinDominoById,
  leaveDominoTable,
  listPublicDominoTables,
  onDominoTableClosed,
  onDominoTableUpdated,
  passDominoTurn,
  playDominoTile,
  startDominoMatch,
  Tile,
} from '../../api/dominoMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DominoMesa'>;

/** A chave das peças é sempre "menor-maior" — ver gameAssets.ts. */
function tileImage(tile: Tile): number | undefined {
  const [menor, maior] = tile.a <= tile.b ? [tile.a, tile.b] : [tile.b, tile.a];
  return DOMINO_TILE_IMAGES[`${menor}-${maior}`];
}

function errorMessage(error: unknown): string {
  if (error instanceof SocketError || error instanceof ApiError) return error.message;
  return 'Não foi possível falar com o servidor.';
}

export function DominoMesaScreen({ navigation }: Props) {
  const [table, setTable] = useState<DominoTableView | null>(null);
  const [publicTables, setPublicTables] = useState<DominoPublicTable[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [buyIn, setBuyIn] = useState(200);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const me = table?.seats.find((seat) => seat.isYou);
  const isHost = table?.hostUserId === me?.userId;
  const isMyTurn = Boolean(table?.started && me && me.seatIndex === table.turnSeat);

  /*
   * Os assentos do servidor viram lugares em volta da mesa. A cor do time vem junto
   * porque no dominó de dupla saber quem é seu parceiro muda a jogada.
   */
  const lugaresDaMesa = (table?.seats ?? [])
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((seat) => ({
      indice: seat.seatIndex,
      nome: seat.name,
      ehVoce: seat.isYou,
      ehVez: Boolean(table?.started) && seat.seatIndex === table?.turnSeat,
      ehBot: seat.isBot,
      naMao: seat.tilesInHand,
      corDoTime: seat.team === 'A' ? colors.gold : colors.ruby,
      detalhe: table?.started
        ? `${seat.tilesInHand} peça${seat.tilesInHand === 1 ? '' : 's'}`
        : seat.isPartner
          ? 'seu parceiro'
          : 'aguardando',
    }));

  const refreshPublic = useCallback(async () => {
    try {
      setPublicTables(await listPublicDominoTables());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    refreshPublic();
  }, [refreshPublic]);

  useEffect(() => {
    const offUpdate = onDominoTableUpdated((updated) => {
      setTable((current) => (current && current.id === updated.id ? updated : current));
      setSelectedTile(null);
    });
    const offClosed = onDominoTableClosed(() => {
      setTable(null);
      setNotice('A mesa foi fechada.');
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

  /** Qual ponta essa peça encaixa — vira o rótulo dos botões de jogar. */
  const encaixes = (tile: Tile) => {
    if (!table) return { esquerda: false, direita: false };
    if (table.board.length === 0) return { esquerda: true, direita: true };
    const bate = (ponta: number | null) => ponta !== null && (tile.a === ponta || tile.b === ponta);
    return { esquerda: bate(table.leftEnd), direita: bate(table.rightEnd) };
  };

  const jogar = (tile: Tile, end: 'esquerda' | 'direita') =>
    run(async () => {
      if (!table) return;
      setTable(await playDominoTile(table.id, tile, end));
      setSelectedTile(null);
    });

  return (
    <GameBackdrop source={TABLE_IMAGES.domino}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Dominó online</Text>
          <View style={styles.iconButton} />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {notice && <Text style={styles.noticeText}>{notice}</Text>}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!table ? (
            <>
              <CasinoCard style={styles.card}>
                <Text style={styles.cardTitle}>Criar mesa</Text>
                <Text style={styles.cardHint}>
                  Dominó de dupla: 2 contra 2, 7 peças pra cada, sem monte de compra. Vence a dupla que
                  chegar a 6 pontos.
                </Text>
                <Text style={styles.cardHint}>
                  Batida simples vale 1, carroça vale 2, lá-e-lô vale 3 e cruzada vale 4.
                </Text>

                <View style={styles.amountRow}>
                  <Pressable onPress={() => setBuyIn((v) => Math.max(100, v - 100))} style={styles.stepButton}>
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.amountLabel}>{buyIn.toLocaleString('pt-BR')} fichas</Text>
                  <Pressable onPress={() => setBuyIn((v) => Math.min(5000, v + 100))} style={styles.stepButton}>
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    onPress={() => run(async () => setTable(await createDominoTable('publica', buyIn)))}
                    style={styles.primaryButton}
                    disabled={busy}
                  >
                    <Text style={styles.primaryLabel}>Pública</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => run(async () => setTable(await createDominoTable('privada', buyIn)))}
                    style={styles.secondaryButton}
                    disabled={busy}
                  >
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
                  <Pressable
                    onPress={() => run(async () => { if (codeInput.trim()) { setTable(await joinDominoByCode(codeInput.trim())); setCodeInput(''); } })}
                    style={styles.primaryButton}
                    disabled={busy}
                  >
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
                    onPress={() => run(async () => setTable(await joinDominoById(item.id)))}
                    style={styles.publicRow}
                    disabled={busy}
                  >
                    <View>
                      <Text style={styles.publicHost}>Mesa de {item.hostName}</Text>
                      <Text style={styles.cardHint}>
                        {item.seatedCount}/{item.maxSeats} · {item.buyIn} fichas
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
                  <Pressable
                    onPress={() => run(async () => { await leaveDominoTable(table.id); setTable(null); refreshPublic(); })}
                    hitSlop={12}
                    disabled={busy}
                  >
                    <Text style={styles.leaveLabel}>Sair</Text>
                  </Pressable>
                </View>

                <View style={styles.scoreRow}>
                  <ScoreBox label="Nós (dupla A)" value={table.score.A} highlight={me?.team === 'A'} />
                  <ScoreBox label="Eles (dupla B)" value={table.score.B} highlight={me?.team === 'B'} />
                </View>
                <Text style={styles.cardHint}>Vence quem chegar a {table.pointsToWin} pontos.</Text>

                {table.lastEvent && <Text style={styles.eventText}>{table.lastEvent}</Text>}

              </CasinoCard>

              {!table.started ? (
                <CasinoCard style={styles.card}>
                  <Text style={styles.cardTitle}>Esperando jogadores ({table.seats.length}/4)</Text>
                  {isHost ? (
                    <View style={styles.buttonRow}>
                      <Pressable
                        onPress={() => run(async () => setTable(await addDominoBot(table.id)))}
                        style={styles.secondaryButton}
                        disabled={busy || table.seats.length >= 4}
                      >
                        <Text style={styles.secondaryLabel}>Completar com bot</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => run(async () => setTable(await startDominoMatch(table.id)))}
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
                  {/*
                    A mesa de verdade, com as pessoas em volta: você sempre embaixo, a
                    corrente no miolo e a mão dos outros de costas. Antes isto era uma
                    LISTA de nomes com o tabuleiro numa tira que rolava de lado — dava
                    pra jogar, mas não dava pra ver a mesa.
                  */}
                  <MesaComLugares lugares={lugaresDaMesa} altura={330}>
                    {table.board.length === 0 ? (
                      <Text style={styles.cardHint}>Mesa vazia — a primeira peça abre o jogo.</Text>
                    ) : (
                      <CorrenteDeDomino pecas={table.board} />
                    )}
                  </MesaComLugares>

                  {table.board.length > 0 && (
                    <Text style={styles.pontasLabel}>
                      Pontas · {table.leftEnd} e {table.rightEnd}
                    </Text>
                  )}

                  <CasinoCard style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {isMyTurn ? (table.canPlayNow ? 'Sua vez — escolha uma peça' : 'Sua vez, mas nenhuma peça encaixa') : 'Esperando os outros...'}
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handRow}>
                      {(me?.hand ?? []).map((tile, index) => {
                        const selecionada = selectedTile?.a === tile.a && selectedTile?.b === tile.b;
                        const enc = encaixes(tile);
                        const jogavel = enc.esquerda || enc.direita;
                        return (
                          <Pressable
                            key={`${tile.a}-${tile.b}-${index}`}
                            onPress={() => setSelectedTile(selecionada ? null : tile)}
                            disabled={busy || !isMyTurn || !jogavel}
                            style={[
                              styles.handTileWrap,
                              selecionada && styles.handTileSelected,
                              (!isMyTurn || !jogavel) && styles.buttonDisabled,
                            ]}
                          >
                            <Image source={tileImage(tile)} style={styles.handTile} resizeMode="contain" />
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {selectedTile && isMyTurn && (
                      <View style={styles.buttonRow}>
                        {encaixes(selectedTile).esquerda && (
                          <Pressable onPress={() => jogar(selectedTile, 'esquerda')} style={styles.primaryButton} disabled={busy}>
                            <Text style={styles.primaryLabel}>◀ Ponta esquerda</Text>
                          </Pressable>
                        )}
                        {encaixes(selectedTile).direita && (
                          <Pressable onPress={() => jogar(selectedTile, 'direita')} style={styles.primaryButton} disabled={busy}>
                            <Text style={styles.primaryLabel}>Ponta direita ▶</Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {isMyTurn && !table.canPlayNow && (
                      <Pressable
                        onPress={() => run(async () => setTable(await passDominoTurn(table.id)))}
                        style={styles.secondaryButton}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.textPrimary} />
                        ) : (
                          <Text style={styles.secondaryLabel}>Passar a vez</Text>
                        )}
                      </Pressable>
                    )}
                  </CasinoCard>
                </>
              )}

              <ChatPanel roomId={table.id} scope="mesa" comDupla />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GameBackdrop>
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
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.xs },
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
    minWidth: 110,
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
    minWidth: 110,
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
  buttonDisabled: { opacity: 0.45 },
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
  eventText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  pontasLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
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
  boardRow: { gap: 3, alignItems: 'center', minHeight: 56, paddingVertical: spacing.xs },
  boardTile: { width: 26, height: 50 },
  handRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  handTileWrap: { borderRadius: radius.sm, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  handTileSelected: { borderColor: colors.goldBright, backgroundColor: colors.felt },
  handTile: { width: 38, height: 74 },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  noticeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.goldBright, textAlign: 'center', marginTop: spacing.sm },
});
