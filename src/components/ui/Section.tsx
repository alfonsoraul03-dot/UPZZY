import { StyleSheet, View } from 'react-native';

import { space, useTheme } from '@/theme';

import { Text } from './Text';

type SectionProps = {
  /** Small index shown before the title, e.g. "01". */
  index?: string;
  title: string;
  /** Optional right-aligned element, e.g. a "See all" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function Section({ index, title, action, children }: SectionProps) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { borderTopColor: theme.text }]}>
        <View style={styles.titleRow}>
          {index ? (
            <Text variant="label" color="textMuted">
              {index}
            </Text>
          ) : null}
          <Text variant="h2">{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  header: {
    borderTopWidth: 2,
    paddingTop: space.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexShrink: 1 },
});
