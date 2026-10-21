import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Avatar, Button, Screen, Text, Toggle } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { friendlyError, getRanking, type RankRow } from '@/lib/social';
import { displayName, monthName, type FeedScope } from '@/social/rules';
import { fonts, radius, space, useTheme } from '@/theme';

const SCOPES = ['friends', 'global'] as const;

/** This month's points, for everyone or for you and the people you follow. */
export default function RankingScreen() {
  const theme = useTheme();
  const { userId, ready, configured } = useSession();
  const [scope, setScope] = useState<FeedScope>('global');
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured || !ready) return;
    if (scope === 'friends' && !userId) {
      setRows([]);
      return;
    }
    try {
      setRows(await getRanking(scope));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [configured, ready, scope, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = (
    <View style={styles.header}>
      <Wordmark />
    </View>
  );

  const name = (r: RankRow) => (r.user_id === userId ? 'you' : displayName(r.username).replace(/^@/, ''));
  const open = (r: RankRow) => router.push({ pathname: '/user/[id]', params: { id: r.user_id } });

  let list: React.ReactNode;
  if (!configured) list = <Text color="textMuted">not connected yet.</Text>;
  else if (error)
    list = (
      <View style={styles.gap}>
        <Text variant="title">{error}</Text>
        <Button label="try again" variant="outline" onPress={load} />
      </View>
    );
  else if (!rows) list = <Text color="textMuted">loading…</Text>;
  else if (!rows.length)
    list = (
      <Text color="textMuted">
        {scope === 'friends' && !userId ? 'sign in to see friends.' : 'no points yet this month. be early tomorrow.'}
      </Text>
    );
  else
    list = (
      <View style={styles.gap}>
        <View style={styles.podium}>
          {/* Podium: second, first, third. */}
          {[rows[1], rows[0], rows[2]].filter((r): r is RankRow => !!r).map((r) => (
            <Pressable
              key={r.user_id}
              onPress={() => open(r)}
              accessibilityRole="link"
              accessibilityLabel={`${r.rank}. ${name(r)}, ${r.points} points`}
              style={({ pressed }) => [
                styles.podiumCard,
                { backgroundColor: theme.surface, borderColor: r.user_id === userId ? theme.text : 'transparent', opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text variant="label" color="textMuted">
                #{r.rank}
              </Text>
              <Avatar name={r.username} size={r.rank === 1 ? 64 : 52} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {name(r)}
              </Text>
              <Text variant="title">{r.points}</Text>
              <Text variant="caption" color="textMuted">
                pts
              </Text>
            </Pressable>
          ))}
        </View>
        <View>
          {rows.slice(3).map((r) => {
            const mine = r.user_id === userId;
            return (
              <Pressable
                key={r.user_id}
                onPress={() => open(r)}
                accessibilityRole="link"
                style={({ pressed }) => [styles.row, mine && { backgroundColor: theme.surface }, { opacity: pressed ? 0.6 : 1 }]}>
                <Text color="textMuted" style={styles.rank}>
                  {r.rank}
                </Text>
                <Avatar name={r.username} size={40} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {name(r)}
                </Text>
                <Text style={styles.rowPoints}>{r.points} pts</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );

  return (
    <Screen header={header}>
      <View style={styles.gap}>
        <Toggle options={SCOPES} value={scope} onChange={(s) => { setRows(null); setScope(s); }} />
        <View style={styles.titles}>
          <Text variant="heading" style={styles.centerText}>
            {monthName(new Date())}
          </Text>
          <Text color="textMuted" style={styles.centerText}>
            the earlier you post after the drop, the more points.
          </Text>
        </View>
      </View>
      {list}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.lg },
  titles: { gap: space.xs, marginTop: space.sm },
  centerText: { textAlign: 'center' },
  podium: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  podiumCard: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.lg, paddingHorizontal: space.sm, borderRadius: radius.lg, borderWidth: 1.5 },
  podiumName: { fontFamily: fonts.bodyBold, maxWidth: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.lg },
  rank: { width: 26, fontFamily: fonts.bodyBold, textAlign: 'center' },
  rowName: { flex: 1, fontFamily: fonts.bodyBold },
  rowPoints: { fontFamily: fonts.bodyBold },
});
