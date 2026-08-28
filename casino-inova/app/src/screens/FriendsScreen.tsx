import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { fetchFriends, fetchPendingFriendRequests, sendFriendRequest, respondFriendRequest, Friend, PendingRequests } from '../api/friends';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { GoldButton } from '../components/GoldButton';

export function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequests>({ recebidos: [], enviados: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [friendsData, pendingData] = await Promise.all([fetchFriends(), fetchPendingFriendRequests()]);
      /*
       * Guarda contra resposta fora do formato. O motivo é concreto: quando o curinga
       * do site engoliu /amigos/pendentes, o servidor respondeu 200 com HTML, o corpo
       * virou undefined e a tela quebrou em "Cannot read properties of undefined" —
       * derrubando a navegação inteira, não só esta aba. A causa foi corrigida no
       * servidor; isto aqui é pra que uma resposta estranha nunca mais derrube o app.
       */
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setPending({
        recebidos: pendingData?.recebidos ?? [],
        enviados: pendingData?.enviados ?? [],
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleAdd = async () => {
    if (!targetId.trim() || busyId) return;
    setBusyId('__add__');
    setFormError(null);
    try {
      await sendFriendRequest(targetId.trim());
      setTargetId('');
      await reload();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível enviar o pedido agora.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    setBusyId(requestId);
    try {
      await respondFriendRequest(requestId, accept);
      await reload();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível responder agora.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Amigos</Text>

      <CasinoCard style={styles.addCard}>
        <Text style={styles.addTitle}>Adicionar amigo</Text>
        <Text style={styles.addSubtitle}>Ainda sem busca por nome nesta v1 — peça o ID de conta da pessoa (ex: "u2").</Text>
        <View style={styles.addRow}>
          <TextInput
            value={targetId}
            onChangeText={setTargetId}
            placeholder="ID da conta"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.addInput}
            editable={busyId !== '__add__'}
          />
          <GoldButton label={busyId === '__add__' ? '...' : 'Adicionar'} onPress={handleAdd} variant="felt" style={styles.addButton} />
        </View>
        {formError && <Text style={styles.errorText}>{formError}</Text>}
      </CasinoCard>

      {loading && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      {!loading && !loadError && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {pending.recebidos.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Pedidos recebidos</Text>
              {pending.recebidos.map((request) => (
                <CasinoCard key={request.id} style={styles.row}>
                  <View style={styles.avatar} />
                  <Text style={styles.rowName}>{request.otherUserName}</Text>
                  <View style={styles.requestActions}>
                    <GoldButton label="Aceitar" onPress={() => handleRespond(request.id, true)} style={styles.requestButton} />
                    <GoldButton
                      label="Recusar"
                      variant="felt"
                      onPress={() => handleRespond(request.id, false)}
                      style={styles.requestButton}
                    />
                  </View>
                </CasinoCard>
              ))}
            </>
          )}

          <Text style={styles.sectionLabel}>Seus amigos</Text>
          {friends.length === 0 && <Text style={styles.emptyText}>Nenhum amigo ainda — adicione alguém acima.</Text>}
          {friends.map((friend) => (
            <CasinoCard key={friend.userId} style={styles.row}>
              <View style={styles.avatar} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{friend.name}</Text>
                <Text style={styles.rowStatus}>Nível {friend.level}</Text>
              </View>
            </CasinoCard>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.lg },
  addCard: { marginBottom: spacing.lg, gap: spacing.xs },
  addTitle: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  addSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: {
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
  },
  addButton: { paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.sm },
  loading: { marginTop: spacing.xxxl },
  list: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundElevated, borderWidth: 2, borderColor: colors.feltLine },
  rowInfo: { gap: 2 },
  rowName: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  rowStatus: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  requestButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
