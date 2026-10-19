import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type EmptyStateProps = {
  title: string;
  message: string;
  /** Optional tag such as "Phase 3" or "Soon". */
  tag?: string;
  action?: React.ReactNode;
};

/** Honest placeholder for content that does not exist yet. Never shows fake data. */
export function EmptyState({ title, message, tag, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {tag ? (
        <View style={[styles.tag, { borderColor: theme.textMuted }]}>
          <Text variant="label" color="textMuted">
            {tag}
          </Text>
        </View>
      ) : null}
      <Text variant="title">{title}</Text>
      <Text variant="caption" color="textSecondary">
        {message}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    marginBottom: space.xs,
  },
  action: { marginTop: space.md },
});
