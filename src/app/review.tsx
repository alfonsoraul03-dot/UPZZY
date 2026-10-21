import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { friendlyError, getPendingPosts, isStaff, photoUrls, reviewPost, type PendingPost } from '@/lib/social';
import { radius, space, useTheme } from '@/theme';

/**
 * Staff only: check each photo for an UPZZY piece. Approved photos earn their
 * points and likes; turned-down ones earn nothing. The server checks the role.
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const { userId, ready } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PendingPost[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getPendingPosts();
      setUrls(await photoUrls(list.map((p) => p.image_path)));
      setQueue(list);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace('/account');
      return;
    }
    isStaff().then(
      (ok) => {
        setAllowed(ok);
        if (ok) load();
      },
      (e) => setError(friendlyError(e)),
    );
  }, [ready, userId, load]);

  const decide = async (post: PendingPost, hasUpzzy: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await reviewPost(post.id, hasUpzzy);
      setQueue((q) => (q ?? []).filter((p) => p.id !== post.id));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (allowed === false) {
    return (
      <Sheet title="upzzy check">
        <Text variant="title">staff only.</Text>
      </Sheet>
    );
  }

  const post = queue?.[0];
  return (
    <Sheet title="upzzy check">
      {error ? <Text color="textMuted">{error}</Text> : null}
      {!queue ? (
        <Text color="textMuted">loading…</Text>
      ) : !post ? (
        <>
          <Text variant="title">all checked.</Text>
          <Button label="look again" variant="outline" onPress={load} />
        </>
      ) : (
        <>
          <Text color="textMuted">
            {queue.length} waiting · +{post.points} pts if approved
          </Text>
          <View style={[styles.photo, { backgroundColor: theme.surface }]}>
            {urls[post.image_path] ? (
              <Image source={{ uri: urls[post.image_path] }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="photo to check" />
            ) : null}
          </View>
          {post.caption ? <Text>{post.caption}</Text> : null}
          <Text variant="title">is an upzzy piece in the photo?</Text>
          <View style={styles.row}>
            <Button label="no upzzy" variant="outline" onPress={() => decide(post, false)} disabled={busy} style={styles.half} />
            <Button label="yes, approve" onPress={() => decide(post, true)} disabled={busy} style={styles.half} />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
