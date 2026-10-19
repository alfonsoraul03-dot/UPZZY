import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { EmptyState, Screen, Section, Text } from '@/components/ui';
import { space, useTheme } from '@/theme';

const RULES = [
  'Official challenges only accept a new photo taken with the UPZZY camera. Gallery uploads do not count.',
  'Every submission is linked to your account and can be reviewed by moderators before it counts.',
  'Each challenge can only be completed once. Rejected submissions never count.',
];

export default function ChallengesScreen() {
  const theme = useTheme();
  return (
    <Screen header={<AppHeader title="Challenges" />}>
      <View style={styles.intro}>
        <Text variant="h1">Show up.{'\n'}Shoot it.</Text>
        <Text color="textSecondary">Daily camera challenges, monthly competitions and long-term global quests.</Text>
      </View>

      <Section index="01" title="Active">
        <EmptyState tag="Phase 3" title="No active challenges" message="Published challenges will be listed here with their deadline and reward." />
      </Section>

      <Section index="02" title="Global">
        <EmptyState
          tag="Phase 6"
          title="UPZZY Around the World"
          message="Long-term quests like visiting new countries in UPZZY will run here, with their own rules, gallery and leaderboard."
        />
      </Section>

      <Section index="03" title="How it counts">
        <View style={styles.rules}>
          {RULES.map((rule, i) => (
            <View key={rule} style={[styles.rule, { borderBottomColor: theme.border }]}>
              <Text variant="label" color="accentText">
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.xl, gap: space.md },
  rules: {},
  rule: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  ruleText: { flex: 1 },
});
