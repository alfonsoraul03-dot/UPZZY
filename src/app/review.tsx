import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, Toggle } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import {
  banUser,
  friendlyError,
  getPendingPosts,
  getReportQueue,
  isStaff,
  moderatePost,
  photoUrls,
  reviewPost,
  type PendingPost,
  type ReportedPost,
} from '@/lib/social';
import { displayName } from '@/social/rules';
import { radius, space, useTheme } from '@/theme';

const TABS = ['reports', 'upzzy check'] as const;
type Tab = (typeof TABS)[number];

/**
 * Staff only. Reports: act on every reported photo (keep it, take it down, or
 * ban the person). Upzzy check: approved photos earn their points. The server
 * checks the role and logs every decision.
 */
export default function ReviewScreen() {
  const { userId, ready } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('reports');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace('/account');
      return;
    }
    isStaff().then(setAllowed, (e) => setError(friendlyError(e)));
  }, [ready, userId]);

  if (allowed === false) {
    return (
      <Sheet title="staff">
        <Text variant="title">staff only.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet title="staff">
      <Toggle options={TABS} value={tab} onChange={setTab} />
      {error ? <Text color="textMuted">{error}</Text> : null}
      {allowed ? tab === 'reports' ? <Reports /> : <UpzzyCheck /> : null}
    </Sheet>
  );
}

function usePhotos<T>(load: () => Promise<T[]>, path: (item: T) => string) {
  const [queue, setQueue] = useState<T[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await load();
      setUrls(await photoUrls(list.map(path)));
      setQueue(list);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [load, path]);

  useEffect(() => {
    load()
      .then(async (list) => {
        setUrls(await photoUrls(list.map(path)));
        setQueue(list);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [load, path]);

  return { queue, setQueue, urls, error, setError, refresh };
}

const reportPath = (p: ReportedPost) => p.image_path;
const pendingPath = (p: PendingPost) => p.image_path;

function Photo({ uri }: { uri?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.photo, { backgroundColor: theme.surface }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="photo to check" /> : null}
    </View>
  );
}

function Reports() {
  const { queue, setQueue, urls, error, setError, refresh } = usePhotos(getReportQueue, reportPath);
  const [busy, setBusy] = useState(false);

  const act = async (post: ReportedPost, action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      // A ban takes down every photo of that person, so drop them all.
      setQueue((q) => (q ?? []).filter((p) => p.post_id !== post.post_id));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const post = queue?.[0];
  if (error && !queue) return <Text color="textMuted">{error}</Text>;
  if (!queue) return <Text color="textMuted">loading…</Text>;
  if (!post)
    return (
      <>
        <Text variant="title">no reports.</Text>
        <Button label="look again" variant="outline" onPress={refresh} />
      </>
    );
  return (
    <>
      <Text color="textMuted">
        {queue.length} to check · act within 24 hours
      </Text>
      <Photo uri={urls[post.image_path]} />
      <Text variant="bodyStrong">
        {displayName(post.username)} · {post.reports} {post.reports === 1 ? 'report' : 'reports'}: {post.reasons.join(', ')}
      </Text>
      {post.status === 'hidden' ? <Text color="textMuted">hidden already after 3 reports.</Text> : null}
      {post.caption ? <Text>{post.caption}</Text> : null}
      {error ? <Text color="textMuted">{error}</Text> : null}
      <View style={styles.row}>
        <Button label="keep it" variant="outline" onPress={() => act(post, () => moderatePost(post.post_id, true))} disabled={busy} style={styles.half} />
        <Button label="take it down" onPress={() => act(post, () => moderatePost(post.post_id, false))} disabled={busy} style={styles.half} />
      </View>
      <Button
        label="ban this person"
        variant="outline"
        onPress={() =>
          act(post, async () => {
            await banUser(post.user_id, post.reasons.join(', '));
            setQueue((q) => (q ?? []).filter((p) => p.user_id !== post.user_id));
          })
        }
        disabled={busy}
      />
    </>
  );
}

function UpzzyCheck() {
  const { queue, setQueue, urls, error, setError, refresh } = usePhotos(getPendingPosts, pendingPath);
  const [busy, setBusy] = useState(false);

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

  const post = queue?.[0];
  if (error && !queue) return <Text color="textMuted">{error}</Text>;
  if (!queue) return <Text color="textMuted">loading…</Text>;
  if (!post)
    return (
      <>
        <Text variant="title">all checked.</Text>
        <Button label="look again" variant="outline" onPress={refresh} />
      </>
    );
  return (
    <>
      <Text color="textMuted">
        {queue.length} waiting · +{post.points} pts if approved
      </Text>
      <Photo uri={urls[post.image_path]} />
      {post.caption ? <Text>{post.caption}</Text> : null}
      {error ? <Text color="textMuted">{error}</Text> : null}
      <Text variant="title">is an upzzy piece in the photo?</Text>
      <View style={styles.row}>
        <Button label="no upzzy" variant="outline" onPress={() => decide(post, false)} disabled={busy} style={styles.half} />
        <Button label="yes, approve" onPress={() => decide(post, true)} disabled={busy} style={styles.half} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
