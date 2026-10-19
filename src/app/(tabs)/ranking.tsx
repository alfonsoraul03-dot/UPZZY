import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Screen, Text, Toggle } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { friendlyError, getRanking, type RankRow } from '@/lib/social';
import { displayName, monthName, type FeedScope } from '@/social/rules';
import { fonts, space, useTheme } from '@/theme';

const SCOPES = ['global', 'friends'] as const;

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
      <Text variant="label" color="textMuted">
        {monthName(new Date())}
      </Text>
    </View>
  );

  let list: React.ReactNode;
  if (!configured) list = <Text color="textMuted">not connected yet.</Text>;
  else if (error) list = (
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
      <View>
        {rows.map((r) => {
          const mine = r.user_id === userId;
          const weight = { fontFamily: mine ? fonts.bodySemiBold : fonts.body };
          return (
            <Pressable
              key={r.user_id}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: r.user_id } })}
              accessibilityRole="link"
              style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
              <Text variant="label" color="textMuted" style={styles.rank}>
                {String(r.rank).padStart(2, '0')}
              </Text>
              <Text style={[styles.name, weight]} numberOfLines={1}>
                {mine ? 'you' : displayName(r.username)}
              </Text>
              <Text style={weight}>{r.points} pts</Text>
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <Screen header={header}>
      <View style={styles.gap}>
        <Text variant="title">who was quickest this month.</Text>
        <Text color="textMuted">the earlier you post after the drop, the more points.</Text>
        <Toggle options={SCOPES} value={scope} onChange={(s) => { setRows(null); setScope(s); }} />
      </View>
      {list}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gap: { gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 24 },
  name: { flex: 1 },
});
