import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { Badge, EmptyState, Screen, Section, Text } from '@/components/ui';
import { space } from '@/theme';

export default function CommunityScreen() {
  return (
    <Screen header={<AppHeader title="Community" />}>
      <View style={styles.intro}>
        <Text variant="h1">Your{'\n'}people.</Text>
        <Text color="textSecondary">Friends, photos, messages and meetups from the UPZZY community.</Text>
      </View>

      <Section index="01" title="Feed">
        <EmptyState tag="Phase 4" title="No posts yet" message="Posts from members you follow and public challenge photos will appear here." />
      </Section>

      <Section index="02" title="Messages">
        <EmptyState tag="Phase 7" title="No conversations" message="Direct messages and meetup group chats will live here." />
      </Section>

      <Section index="03" title="First 100" action={<Badge kind="founder" label="Founders" />}>
        <EmptyState
          title="A permanent club of 100"
          message="The first 100 customers who complete a qualifying UPZZY purchase become Founding Members for life. Places are allocated by verified order data, never by sign-up order, and never recycled."
          tag="Phase 2"
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.xl, gap: space.md },
});
