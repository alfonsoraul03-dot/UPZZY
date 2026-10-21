import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import {
  areFriends,
  friendlyError,
  getMessages,
  getUserStats,
  markRead,
  onNewMessage,
  sendMessage,
  type Message,
} from '@/lib/social';
import { chatTime, displayName, MESSAGE_MAX, normalizeMessage } from '@/social/rules';
import { fonts, layout, radius, space, useTheme } from '@/theme';

/** Realtime brings new messages at once; this is a fallback if it drops. */
const POLL_MS = 10_000;

/** One conversation with a friend. */
export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, ready } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [friends, setFriends] = useState(true);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !id) return;
    try {
      const list = await getMessages(userId, id);
      setMessages(list);
      setError(null);
      if (list.some((m) => m.sender_id === id && !m.read_at)) await markRead(id);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [userId, id]);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace('/account');
      return;
    }
    if (!id) return;
    getUserStats(id).then((s) => setName(s?.username ?? null), () => {});
    areFriends(userId, id).then(setFriends, () => {});
  }, [ready, userId, id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, POLL_MS);
      const stop = userId ? onNewMessage(userId, (m) => m.sender_id === id && load()) : () => {};
      return () => {
        clearInterval(timer);
        stop();
      };
    }, [load, userId, id]),
  );

  const send = async () => {
    const body = normalizeMessage(draft);
    if (!body || !id || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendMessage(id, body);
      haptic('tap');
      setDraft('');
      setMessages((list) => [sent, ...(list ?? []).filter((m) => m.id !== sent.id)]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const canSend = !!normalizeMessage(draft) && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} accessibilityRole="button" hitSlop={12}>
          <Text color="textMuted">back</Text>
        </Pressable>
        <Pressable
          onPress={() => id && router.push({ pathname: '/user/[id]', params: { id } })}
          accessibilityRole="link"
          hitSlop={12}
          style={styles.title}>
          <Text style={{ fontFamily: fonts.bodySemiBold }} numberOfLines={1}>
            {displayName(name)}
          </Text>
        </Pressable>
        <View style={styles.barSide} />
      </View>

      <FlatList
        inverted
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          // Inverted lists flip their children too; flip the empty state back.
          <View style={styles.empty}>
            <Text color="textMuted">{messages ? 'no messages yet. say hi.' : error ?? 'loading…'}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = item.sender_id === userId;
          const older = messages?.[index + 1];
          const showTime = !older || new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > 10 * 60_000;
          return (
            <View style={[styles.message, mine ? styles.mine : styles.theirs]}>
              {showTime ? (
                <Text variant="caption" color="textMuted" style={styles.time}>
                  {chatTime(item.created_at, new Date())}
                </Text>
              ) : null}
              <View style={[styles.bubble, mine ? { backgroundColor: theme.text } : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
                <Text style={{ color: mine ? theme.onText : theme.text }}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { borderTopColor: theme.border, paddingBottom: insets.bottom + space.sm }]}>
        {error && messages ? (
          <Text variant="caption" color="textMuted">
            {error}
          </Text>
        ) : null}
        {friends ? (
          <View style={styles.inputRow}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder="message"
              maxLength={MESSAGE_MAX}
              multiline
              style={styles.input}
              accessibilityLabel="message"
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="send"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [styles.send, { backgroundColor: theme.text, opacity: !canSend ? 0.4 : pressed ? 0.75 : 1 }]}>
              <Text style={{ color: theme.onText, fontFamily: fonts.bodySemiBold }}>{sending ? '…' : 'send'}</Text>
            </Pressable>
          </View>
        ) : (
          <Text color="textMuted">you are not friends anymore. follow each other to talk again.</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    height: 56,
    paddingHorizontal: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, alignItems: 'center' },
  barSide: { width: 36 },
  list: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingVertical: space.lg, gap: space.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: -1 }] },
  message: { maxWidth: '80%', gap: space.xxs },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  time: { marginTop: space.md },
  bubble: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  composer: { paddingHorizontal: layout.gutter, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: space.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, maxHeight: 120, paddingTop: 15, paddingBottom: 15 },
  send: { height: 54, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
