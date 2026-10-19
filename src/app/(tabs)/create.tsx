import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { Badge, Screen, Text } from '@/components/ui';
import { radius, space, useTheme } from '@/theme';

const OPTIONS = [
  { title: 'Challenge photo', body: 'Capture a new photo with the in-app camera for an official challenge.', phase: 'Phase 3' },
  { title: 'Post', body: 'Share a photo from your camera or gallery with the community.', phase: 'Phase 4' },
  { title: 'Meetup', body: 'Organise a meetup in your city and chat with the people who join.', phase: 'Phase 7' },
  { title: 'Design', body: 'Submit an original tee or hoodie design to the Creator Club.', phase: 'Phase 9' },
];

export default function CreateScreen() {
  const theme = useTheme();
  return (
    <Screen header={<AppHeader title="Create" />}>
      <View style={styles.intro}>
        <Text variant="h1">Make{'\n'}something.</Text>
        <Text color="textSecondary">Everything you add to UPZZY starts here.</Text>
      </View>
      <View style={styles.list}>
        {OPTIONS.map((option) => (
          <View
            key={option.title}
            accessible
            accessibilityLabel={`${option.title}. ${option.body} Available in ${option.phase}.`}
            style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={styles.optionHead}>
              <Text variant="title">{option.title}</Text>
              <Badge label={option.phase} />
            </View>
            <Text variant="caption" color="textSecondary">
              {option.body}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.xl, gap: space.md },
  list: { gap: space.md },
  option: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  optionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
