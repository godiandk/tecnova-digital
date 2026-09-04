import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, Modal } from 'react-native';
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
import { BancaFrancesaBet, BancaFrancesaConfig, fetchBancaFrancesaConfig } from '../../api/bancaFrancesa';
import { MeuNivel, fetchMeuNivel } from '../../api/niveis';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { PanoDaBancaFrancesa } from './PanoDaBancaFrancesa';
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
  withdrawBets,
  PublicTableSummary,
  TableView,
} from '../../api/bancaFrancesaMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesaMesa'>;

function errorMessage(error: unknown): string {
  if (error instanceof SocketError || error instanceof ApiError) return error.message;
  return 'Não foi possível falar com o servidor.';
}

export function BancaFrancesaMesaScreen({ navigation }: Props) {
  const [table, setTable] = useState<TableView | null>(null);
  const [publicTables, setPublicTables] = useState<PublicTableSummary[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [config, setConfig] = useState<BancaFrancesaConfig | null>(null);
  /*
   * O nível DESTA pessoa — é dele que saem o mínimo, o máximo e as fichas do trilho.
   *
   * A configuração do jogo (`config`) é pública e traz os limites do nível de entrada,
   * iguais pra todo mundo. Antes eram esses que a mesa usava, e por isso quem tinha cem
   * milhões via um trilho de 5 a 1.000 e um teto de 5.000 por aposta.
   */
  const [meuNivel, setMeuNivel] = useState<MeuNivel | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { jogador } = usePlayer();
  const isHost = table?.hostUserId === usuarioLogadoId();

  /*
   * O saldo de verdade já vem no estado da mesa, a cada rodada, no assento de quem está
   * jogando. Sem esta linha o número no topo ficava parado enquanto a pessoa jogava —
   * ela perdia ficha rodada após rodada lendo o mesmo 10.000, porque o `usePlayer` só
   * busca quando a tela monta ou ganha foco, e a tela da mesa nunca perde o foco.
   */
  const meuSaldoNaMesa = table?.seats.find((seat) => seat.userId === usuarioLogadoId())?.balance;
  useEffect(() => {
    if (typeof meuSaldoNaMesa === 'number') saldoChegouDeFora(meuSaldoNaMesa);
  }, [meuSaldoNaMesa]);

  useEffect(() => {
    fetchBancaFrancesaConfig().then(setConfig).catch(() => undefined);
  }, []);

  /*
   * O nível é buscado de novo sempre que o SALDO muda — ganhar uma rodada grande, ou
   * receber fichas pelo painel, pode subir a pessoa de mesa. Sem isto, o trilho ficaria
   * no nível de quando a tela abriu, e a pessoa com dez milhões continuaria apostando
   * com fichas de mil até sair e voltar.
   */
  const saldoAtual = jogador?.chipBalance ?? 0;
  useEffect(() => {
    fetchMeuNivel().then(setMeuNivel).catch(() => undefined);
  }, [saldoAtual]);

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

  /**
   * Devolve se deu certo.
   *
   * Antes engolia o erro e devolvia `void`, então quem chamava não tinha como saber se
   * a ação valeu. No pano isso virava um bug de verdade: a pessoa montava a aposta, o
   * servidor recusava, e as fichas sumiam da mesa do mesmo jeito — porque a limpeza
   * acontecia sempre. Agora a montagem só é desfeita quando ela realmente foi pro
   * servidor.
   */
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
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

  const handlePlaceBets = (bets: BancaFrancesaBet[]) =>
    run(async () => {
      if (!table || bets.length === 0) return;
      setTable(await placeBets(table.id, bets));
      setNotice('Aposta registrada — esperando o anfitrião lançar.');
    });

  const handleRoll = () =>
    run(async () => {
      if (table) {
        setTable(await roll(table.id));
        setNotice(null);
      }
    });

  /*
   * Desistir na janela entre lançamentos. Não custa nada e o aviso diz isso com
   * todas as letras: nesta mesa a ficha só sai do saldo quando o dado decide, então
   * quem tira as fichas no meio de uma sequência de nulos sai com o saldo com que
   * entrou. Dizer isso importa — sem dizer, ninguém usa um botão que parece cobrar.
   */
  const handleWithdraw = () =>
    run(async () => {
      if (!table) return;
      setTable(await withdrawBets(table.id));
      setNotice('Fichas retiradas — você saiu desta rodada sem perder nada.');
    });

  const handleLeave = () =>
    run(async () => {
      if (!table) return;
      await leaveTable(table.id);
      setTable(null);
      setPainelAberto(false);
      setNotice(null);
      refreshPublic();
    });

  /*
   * Duas telas, não uma. Sem mesa, isto é um SALÃO: escolher onde sentar é ler uma
   * lista, e lista é cartão mesmo. Com mesa, isto é a MESA — o pano ocupa tudo, e quem
   * está sentado, o chat e os controles do anfitrião saem de cima do feltro pra um
   * painel que abre por cima. Antes os dois estavam misturados numa rolagem só, e o
   * resultado era jogar Banca Francesa lendo azulejos escritos "Pequeno · 5, 6 ou 7"
   * com a foto da mesa de papel de parede atrás.
   */
  if (table) {
    return (
      <>
        <PanoDaBancaFrancesa
          mesa={table}
          meuId={usuarioLogadoId()}
          ehAnfitriao={isHost}
          ocupado={busy}
          saldo={jogador?.chipBalance ?? 0}
          minimo={meuNivel?.nivel.minimo ?? config?.minBet ?? 50}
          nomeDoNivel={meuNivel?.nivel.nome}
          fichasDaMesa={meuNivel?.nivel.fichas}
          config={config}
          onApostar={handlePlaceBets}
          onGirar={handleRoll}
          onRetirar={handleWithdraw}
          onSair={handleLeave}
          onAbrirPainel={() => setPainelAberto(true)}
          erro={error}
          aviso={notice}
        />

        <Modal visible={painelAberto} animationType="slide" transparent onRequestClose={() => setPainelAberto(false)}>
          <View style={styles.painelFundo}>
            <SafeAreaView style={styles.painel} edges={['bottom']}>
              <View style={styles.painelTopo}>
                <Text style={styles.cardTitle}>
                  {table.visibility === 'privada' ? `Código: ${table.code}` : 'Mesa pública'}
                </Text>
                <Pressable onPress={() => setPainelAberto(false)} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <CasinoCard style={styles.card}>
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

                {isHost && (
                  <CasinoCard style={styles.card}>
                    <Text style={styles.cardTitle}>Controles do anfitrião</Text>
                    <Pressable onPress={handleAddBot} style={styles.secondaryButton} disabled={busy}>
                      <Text style={styles.secondaryLabel}>Completar com bot</Text>
                    </Pressable>
                    {friends.length > 0 && (
                      <>
                        <Text style={styles.sectionLabel}>Convidar amigo</Text>
                        {friends.map((friend) => (
                          <Pressable key={friend.userId} onPress={() => handleInvite(friend.userId)} style={styles.publicRow} disabled={busy}>
                            <Text style={styles.publicHost}>{friend.name}</Text>
                            <Ionicons name="add-circle" size={22} color={colors.goldBright} />
                          </Pressable>
                        ))}
                      </>
                    )}
                  </CasinoCard>
                )}

                <ChatPanel roomId={table.id} scope="mesa" />
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </>
    );
  }

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
              <Pressable onPress={refreshPublic} hitSlop={12} disabled={busy} accessibilityRole="button" accessibilityLabel="Atualizar a lista">
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
        </ScrollView>
      </SafeAreaView>
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  /* O painel cobre o pano por cima, sem tirar a mesa da tela. */
  painelFundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,6,5,0.72)' },
  painel: {
    maxHeight: '82%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  painelTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
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
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.feltLine,
  },
  publicHost: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
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
  betLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  noticeText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.goldBright, textAlign: 'center', marginTop: spacing.sm },
});
