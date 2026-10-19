import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { BagIcon } from '@/components/brand/icons';
import { Button, EmptyState, Screen, Section, Text } from '@/components/ui';
import { radius, space, useTheme } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <Screen header={<AppHeader />}>
      <View style={[styles.hero, { backgroundColor: theme.inverse }]}>
        <Text variant="label" color="onInverse" style={styles.heroKicker}>
          Streetwear · Community · Worldwide
        </Text>
        <Text variant="display" color="onInverse">
          Wear it.{'\n'}Live it.{'\n'}
          <Text variant="display" color="accentOnInverse">
            Be part of it.
          </Text>
        </Text>
        <Button
          label="Shop UPZZY"
          variant="primary"
          leading={<BagIcon size={18} color={theme.onAccent} />}
          onPress={() => router.push('/store')}
          style={styles.heroCta}
        />
      </View>

      <Section index="01" title="Today's challenge">
        <EmptyState
          tag="Phase 3"
          title="No challenge published yet"
          message="The daily camera challenge will appear here as soon as the UPZZY team publishes it."
        />
      </Section>

      <Section index="02" title="UPZZY Drops">
        <EmptyState
          tag="Phase 5"
          title="No Drop is live"
          message="Free tees go live at surprise times two or three times a week. Turn on notifications so you hear about the next one."
        />
      </Section>

      <Section index="03" title="Community">
        <EmptyState
          tag="Phase 4"
          title="The feed is warming up"
          message="Photos from members and friends' activity will show here."
        />
      </Section>

      <Section index="04" title="Leaderboard">
        <EmptyState
          tag="Phase 6"
          title="No competition running"
          message="Monthly rankings count valid completed challenges, not likes. Rules and prizes are published before each month starts."
        />
      </Section>

      <Section index="05" title="Meetups">
        <EmptyState tag="Phase 7" title="No upcoming meetups" message="Official UPZZY events and community meetups near you will show here." />
      </Section>

      <Section index="06" title="Creator Club">
        <EmptyState
          tag="Phase 9"
          title="Submissions open soon"
          message="Design the next UPZZY tee. One community design a month becomes an official product, and its creator earns a commission on eligible sales."
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: space.lg,
    padding: space.xl,
    paddingTop: space.xxl,
    borderRadius: radius.md,
    gap: space.xl,
  },
  heroKicker: { opacity: 0.7 },
  heroCta: { alignSelf: 'flex-start' },
});
