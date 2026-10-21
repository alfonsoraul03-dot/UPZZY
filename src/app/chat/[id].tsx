import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, Text } from '@/components/ui';
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
import { fonts, radius, space, useTheme } from '@/theme';

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
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
          accessibilityRole="button"
          accessibilityLabel="back"
          hitSlop={12}>
          <Icon name="back" color={theme.text} size={28} weight={2.2} />
        </Pressable>
        <Pressable
          onPress={() => id && router.push({ pathname: '/user/[id]', params: { id } })}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.title}>
          <Avatar name={name} size={36} />
          <View style={styles.titleText}>
            <Text style={{ fontFamily: fonts.bodyBold }} numberOfLines={1}>
              {displayName(name).replace(/^@/, '')}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {friends ? 'friends' : 'not friends anymore'}
            </Text>
          </View>
        </Pressable>
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
          // The list is newest first: index - 1 is the next message down, index + 1 the one above.
          const older = messages?.[index + 1];
          const newer = messages?.[index - 1];
          const showTime = !older || new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > 10 * 60_000;
          const lastOfRun = !newer || newer.sender_id !== item.sender_id;
          return (
            <View>
              {showTime ? (
                <Text variant="caption" color="textMuted" style={styles.time}>
                  {chatTime(item.created_at, new Date())}
                </Text>
              ) : null}
              <View style={[styles.message, mine ? styles.mine : styles.theirs]}>
                {!mine ? <View style={styles.faceSlot}>{lastOfRun ? <Avatar name={name} size={28} /> : null}</View> : null}
                <View style={[styles.bubble, { backgroundColor: mine ? theme.text : theme.border }]}>
                  <Text style={{ color: mine ? theme.onText : theme.text }}>{item.body}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
        {error && messages ? (
          <Text variant="caption" color="textMuted">
            {error}
          </Text>
        ) : null}
        {friends ? (
          <View style={[styles.inputPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="message…"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.text}
              maxLength={MESSAGE_MAX}
              // A web textarea starts two rows tall; one line is enough there.
              multiline={Platform.OS !== 'web'}
              onSubmitEditing={send}
              style={[styles.input, { color: theme.text }, Platform.OS === 'web' && styles.webInput]}
              accessibilityLabel="message"
            />
            {canSend || sending ? (
              <Pressable onPress={send} disabled={!canSend} accessibilityRole="button" accessibilityLabel="send" hitSlop={10}>
                <Text style={{ fontFamily: fonts.bodyBold, color: theme.text, opacity: sending ? 0.5 : 1 }}>send</Text>
              </Pressable>
            ) : null}
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
    height: 60,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleText: { flex: 1 },
  list: { flexGrow: 1, paddingHorizontal: space.md, paddingVertical: space.lg, gap: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: -1 }] },
  time: { textAlign: 'center', marginVertical: space.md },
  message: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, maxWidth: '82%' },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  faceSlot: { width: 28 },
  bubble: { borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 9, flexShrink: 1 },
  composer: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.xs },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: space.lg,
    paddingRight: space.lg,
  },
  input: { flex: 1, maxHeight: 120, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16 },
  // The pill already shows focus; drop the browser's focus box.
  webInput: { outlineStyle: 'none' } as object,
});
