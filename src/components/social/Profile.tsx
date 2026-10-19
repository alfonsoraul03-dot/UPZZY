import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import {
  friendlyError,
  getUserPosts,
  getUserStats,
  photoUrls,
  setFollowing,
  type ProfilePost,
  type UserStats,
} from '@/lib/social';
import { displayName, monthName, shortDay, streakLabel } from '@/social/rules';
import { radius, space, useTheme } from '@/theme';

type ProfileProps = {
  userId: string;
  /** The signed-in user, or null. */
  me: string | null;
  /** Shown under the stats on your own profile (settings, shop). */
  actions?: React.ReactNode;
};

/** Name, streak, points and a grid of challenge photos. */
export function Profile({ userId, me, actions }: ProfileProps) {
  const theme = useTheme();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const isMe = userId === me;

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([getUserStats(userId), getUserPosts(userId)]);
      setUrls(await photoUrls(p.map((x) => x.image_path)));
      setStats(s);
      setPosts(p);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFollow = async () => {
    if (!me) {
      router.push('/account');
      return;
    }
    if (!stats) return;
    haptic('tap');
    const next = !stats.following;
    setStats({ ...stats, following: next });
    try {
      await setFollowing(userId, next, me);
    } catch {
      setStats({ ...stats, following: !next });
    }
  };

  if (!loaded) return <Text color="textMuted">loading…</Text>;
  if (error) {
    return (
      <View style={styles.gap}>
        <Text variant="title">{error}</Text>
        <Button label="try again" variant="outline" onPress={load} />
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <Text variant="title">{isMe ? displayName(stats?.username ?? null).replace('someone', 'you') : displayName(stats?.username ?? null)}</Text>

      <View style={[styles.stats, { borderColor: theme.border }]}>
        <Stat value={stats?.streak ?? 0} label={streakLabel(stats?.streak ?? 0).replace(/^\d+ /, '')} />
        <Stat value={stats?.month_points ?? 0} label={`pts in ${monthName(new Date())}`} />
        <Stat value={stats?.posts ?? 0} label={(stats?.posts ?? 0) === 1 ? 'photo' : 'photos'} />
      </View>

      {!isMe ? (
        <Button label={stats?.following ? 'following' : 'follow'} variant={stats?.following ? 'outline' : 'solid'} onPress={toggleFollow} />
      ) : (
        actions
      )}

      {posts.length ? (
        <View style={styles.grid}>
          {posts.map((p) => (
            <View key={p.id} style={styles.cell}>
              <Image
                source={urls[p.image_path] ? { uri: urls[p.image_path] } : undefined}
                style={[styles.thumb, { backgroundColor: theme.surface }]}
                contentFit="cover"
                accessibilityLabel={p.challenges?.title ?? 'challenge photo'}
              />
              <Text variant="caption" color="textMuted">
                {p.challenges ? shortDay(p.challenges.day) : ''} · +{p.points}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text color="textMuted">{isMe ? 'no photos yet. the next challenge is yours.' : 'no photos yet.'}</Text>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color="textMuted" style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: space.xxs },
  statLabel: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  cell: { width: '33.333%', padding: space.xs, gap: space.xxs },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.sm },
});
