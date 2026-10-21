import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Avatar, Button, Screen, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { friendlyError, getChats, onNewMessage, type Chat } from '@/lib/social';
import { chatTime, displayName } from '@/social/rules';
import { fonts, space, useTheme } from '@/theme';

/** Messages with friends: people you follow who follow you back. */
export default function ChatsScreen() {
  const theme = useTheme();
  const { userId, ready, configured } = useSession();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured || !ready || !userId) return;
    try {
      setChats(await getChats());
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [configured, ready, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // A new message moves its chat to the top.
  useEffect(() => (userId ? onNewMessage(userId, () => load()) : undefined), [userId, load]);

  const header = (
    <View style={styles.header}>
      <Wordmark />
    </View>
  );

  if (!configured || !ready) {
    return (
      <Screen header={header}>
        <Text color="textMuted">{configured ? 'loading…' : 'not connected yet.'}</Text>
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen header={header}>
        <View style={styles.gap}>
          <Text variant="title">talk to your friends.</Text>
          <Text color="textMuted">sign in to start.</Text>
          <Button label="sign in" onPress={() => router.push('/account')} />
        </View>
      </Screen>
    );
  }

  let list: React.ReactNode;
  if (error)
    list = (
      <View style={styles.gap}>
        <Text variant="title">{error}</Text>
        <Button label="try again" variant="outline" onPress={load} />
      </View>
    );
  else if (!chats) list = <Text color="textMuted">loading…</Text>;
  else if (!chats.length)
    list = (
      <View style={styles.gap}>
        <Text variant="title">no friends yet.</Text>
        <Text color="textMuted">follow people from their photos. when they follow you back, you can talk here.</Text>
      </View>
    );
  else
    list = (
      <View>
        {chats.map((c) => {
          const unread = c.unread > 0;
          const preview = c.last_body ? `${c.last_from_me ? 'you: ' : ''}${c.last_body}` : 'say hi.';
          return (
            <Pressable
              key={c.user_id}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.user_id } })}
              accessibilityRole="link"
              accessibilityLabel={`${displayName(c.username)}${unread ? `, ${c.unread} new` : ''}`}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <Avatar name={c.username} size={56} />
              <View style={styles.middle}>
                <Text style={{ fontFamily: unread ? fonts.bodyBold : fonts.bodyMedium }} numberOfLines={1}>
                  {displayName(c.username).replace(/^@/, '')}
                </Text>
                <View style={styles.previewRow}>
                  <Text
                    variant="caption"
                    color={unread ? 'text' : 'textMuted'}
                    style={[styles.preview, unread && { fontFamily: fonts.bodyBold }]}
                    numberOfLines={1}>
                    {unread && c.unread > 1 ? `${c.unread > 9 ? '9+' : c.unread} new messages` : preview}
                  </Text>
                  {c.last_at ? (
                    <Text variant="caption" color="textMuted">
                      {' · '}
                      {chatTime(c.last_at, new Date())}
                    </Text>
                  ) : null}
                </View>
              </View>
              {unread ? <View style={[styles.dot, { backgroundColor: theme.text }]} accessible={false} /> : null}
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <Screen header={header}>
      <View style={styles.gap}>
        <Text variant="heading">messages</Text>
        <Text color="textMuted">friends follow each other. only you two see the chat.</Text>
      </View>
      {list}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  middle: { flex: 1, gap: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
