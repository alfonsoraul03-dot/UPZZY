import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Screen, Text } from '@/components/ui';
import { CHALLENGE_MAX_POINTS, POINTS_PER_FRIEND, POINTS_PER_LIKE, PRIZE_PLACES } from '@/social/rules';
import { fonts, radius, space, useTheme } from '@/theme';

const RULES = [
  { title: 'one challenge a day', line: 'it drops at a random time. wear your upzzy and post it.' },
  { title: `up to ${CHALLENGE_MAX_POINTS} pts`, line: 'every challenge is worth something different. the faster you post, the more you get.' },
  { title: 'no upzzy, no points', line: 'our staff check every photo. a piece has to be in it.' },
  { title: `+${POINTS_PER_LIKE} per like`, line: 'on your checked photos. you cannot like your own.' },
  { title: `+${POINTS_PER_FRIEND} per friend`, line: 'a friend is someone you follow who follows you back.' },
  { title: `top ${PRIZE_PLACES} win free pieces`, line: 'every month, the top 3 of the global ranking get a free upzzy piece.' },
];

/** Right after the code from the package works: what upzzy is and how points work. */
export default function WelcomeScreen() {
  const theme = useTheme();
  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark />
        </View>
      }>
      <View style={styles.gap}>
        <Text variant="heading">welcome to upzzy.</Text>
        <Text color="textMuted">you&apos;re in. here&apos;s how it works.</Text>
      </View>
      <View style={styles.list}>
        {RULES.map((r, i) => (
          <View key={r.title} style={[styles.rule, { backgroundColor: theme.surface }]}>
            <Text style={[styles.number, { color: theme.textMuted }]}>{i + 1}</Text>
            <View style={styles.ruleText}>
              <Text variant="bodyStrong">{r.title}</Text>
              <Text variant="caption" color="textMuted">
                {r.line}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text color="textMuted">this is just the start. more is coming.</Text>
      <Button label="let's go" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.xs },
  list: { gap: space.sm },
  rule: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, alignItems: 'center' },
  number: { fontFamily: fonts.bodySemiBold, fontSize: 20, width: 22 },
  ruleText: { flex: 1, gap: 2 },
});
