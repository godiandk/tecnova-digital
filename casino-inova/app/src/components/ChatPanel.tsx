import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MOCK_USER_ID } from '../api/client';
import { emitWithAck, getSocket, SocketError } from '../api/socket';
import { PLAYER_CHIP_IMAGES, PlayerColor } from '../data/chipImages';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

export type ChatScope = 'mesa' | 'dupla';

export interface ChatMessage {
  id: string;
  roomId: string;
  scope: ChatScope;
  userId: string;
  userName: string;
  color?: PlayerColor;
  text: string;
  at: string;
  isSystem?: boolean;
}

const MAX_LENGTH = 200;

/**
 * Chat da mesa. `scope` é "mesa" (todo mundo vê) ou "dupla" (só o parceiro), que só
 * faz sentido em truco/dominó 2x2. As regras de tamanho, anti-flood e silenciamento
 * são todas do servidor — aqui a gente só mostra o erro que ele devolve.
 */
export function ChatPanel({ roomId, scope = 'mesa' }: { roomId: string; scope?: ChatScope }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;

    emitWithAck<ChatMessage[]>('chat:historico', { userId: MOCK_USER_ID, roomId })
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = getSocket();
    const onMessage = (message: ChatMessage) => {
      // O gateway transmite pra sala inteira; filtra pra não misturar mesas.
      if (message.roomId !== roomId) return;
      setMessages((current) => [...current, message]);
    };
    socket.on('chat:mensagem', onMessage);

    return () => {
      cancelled = true;
      socket.off('chat:mensagem', onMessage);
    };
  }, [roomId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await emitWithAck('chat:enviar', { userId: MOCK_USER_ID, roomId, scope, text });
      setDraft('');
    } catch (caught) {
      setError(caught instanceof SocketError ? caught.message : 'Não deu pra enviar agora.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Ionicons name={scope === 'dupla' ? 'people' : 'chatbubble'} size={14} color={colors.goldBright} />
        <Text style={styles.headerLabel}>{scope === 'dupla' ? 'Conversa da dupla' : 'Chat da mesa'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.goldBright} style={styles.loading} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && <Text style={styles.empty}>Ninguém falou nada ainda.</Text>}
          {messages.map((message) => (
            <View key={message.id} style={styles.messageRow}>
              {message.isSystem ? (
                <Text style={styles.systemText}>{message.text}</Text>
              ) : (
                <>
                  {message.color && PLAYER_CHIP_IMAGES[message.color] && (
                    <Image source={PLAYER_CHIP_IMAGES[message.color]} style={styles.chip} resizeMode="contain" />
                  )}
                  <Text style={styles.messageText}>
                    <Text style={[styles.messageAuthor, message.userId === MOCK_USER_ID && styles.messageAuthorSelf]}>
                      {message.userName}:{' '}
                    </Text>
                    {message.text}
                  </Text>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={scope === 'dupla' ? 'Falar só com o parceiro...' : 'Falar na mesa...'}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          maxLength={MAX_LENGTH}
          editable={!sending}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable onPress={send} disabled={sending || !draft.trim()} style={styles.sendButton} hitSlop={8}>
          <Ionicons
            name="send"
            size={18}
            color={sending || !draft.trim() ? colors.textFaint : colors.goldBright}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loading: { marginVertical: spacing.lg },
  list: { maxHeight: 140 },
  listContent: { gap: 4 },
  empty: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  chip: { width: 14, height: 14, marginTop: 2 },
  messageText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  messageAuthor: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  messageAuthorSelf: { color: colors.goldBright },
  systemText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, fontStyle: 'italic' },
  errorText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.danger },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  sendButton: { padding: 6 },
});
