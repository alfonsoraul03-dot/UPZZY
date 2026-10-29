import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, Text } from '@/components/ui';
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
import { fonts, radius, space, useTheme } from '@/theme';

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

  const name = displayName(stats?.username ?? null);
  const shownName = isMe && name === 'someone' ? 'you' : name.replace(/^@/, '');

  return (
    <View style={styles.gap}>
      <View style={styles.head}>
        <Avatar name={stats?.username ?? null} size={108} />
        <Text variant="heading" style={styles.center}>
          {shownName}
        </Text>
        {name.startsWith('@') ? (
          <Text color="textMuted" style={styles.center}>
            {name}
          </Text>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat value={stats?.streak ?? 0} label={streakLabel(stats?.streak ?? 0).replace(/^\d+ /, '')} icon />
        <Stat value={stats?.month_points ?? 0} label={`pts in ${monthName(new Date())}`} />
        <Stat value={stats?.posts ?? 0} label={(stats?.posts ?? 0) === 1 ? 'photo' : 'photos'} />
      </View>

      {isMe && stats?.pending_points ? (
        <Text color="textMuted" style={styles.center}>
          +{stats.pending_points} pts waiting for the upzzy check.
        </Text>
      ) : null}

      {!isMe ? (
        <View style={styles.row}>
          <Button
            label={stats?.following ? 'following' : 'follow'}
            variant={stats?.following ? 'outline' : 'solid'}
            onPress={toggleFollow}
            style={styles.half}
          />
        </View>
      ) : (
        actions
      )}

      <Text variant="title">{isMe ? 'your memories' : 'memories'}</Text>
      {posts.length ? (
        <View style={styles.grid}>
          {posts.map((p) => (
            <View key={p.id} style={styles.cell}>
              <View style={[styles.thumb, { backgroundColor: theme.surface }]}>
                <Image
                  source={urls[p.image_path] ? { uri: urls[p.image_path] } : undefined}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={p.challenges ? `${shortDay(p.challenges.day)}: ${p.challenges.title}` : 'challenge photo'}
                />
                <Text style={[styles.day, { color: theme.onPhoto, textShadowColor: theme.photoShadow }]}>
                  {p.challenges ? Number(p.challenges.day.slice(8)) : ''}
                </Text>
                <Text style={[styles.pts, { color: theme.onPhoto, textShadowColor: theme.photoShadow }]}>
                  {p.review === 'approved' ? `+${p.points}` : p.review === 'pending' ? 'checking' : 'no upzzy'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text color="textMuted">{isMe ? 'no photos yet. the next challenge is yours.' : 'no photos yet.'}</Text>
      )}
    </View>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface }]}>
      <View style={styles.statValue}>
        <Text variant="title">{value}</Text>
        {icon ? <Icon name="flame" color={theme.text} size={18} weight={2.2} /> : null}
      </View>
      <Text variant="caption" color="textMuted" style={styles.center}>
        {label}
      </Text>
    </View>
  );
}

const shadow = { textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  gap: { gap: space.xl },
  head: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
  center: { textAlign: 'center' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: space.xxs, paddingVertical: space.lg, borderRadius: radius.lg },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3, marginTop: -space.md },
  cell: { width: '25%', padding: 3 },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md + 4, overflow: 'hidden' },
  day: { position: 'absolute', left: 6, bottom: 4, fontFamily: fonts.bodyBold, fontSize: 15, ...shadow },
  pts: { position: 'absolute', right: 6, top: 4, fontFamily: fonts.bodyBold, fontSize: 10, ...shadow },
});
