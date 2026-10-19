import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type BadgeKind = 'founder' | 'creator' | 'live' | 'neutral';

export function Badge({ kind = 'neutral', label }: { kind?: BadgeKind; label: string }) {
  const theme = useTheme();
  const tone = {
    founder: { border: theme.founder, text: 'founder' },
    creator: { border: theme.text, text: 'text' },
    live: { border: theme.accent, text: 'accentText' },
    neutral: { border: theme.border, text: 'textSecondary' },
  }[kind] as { border: string; text: 'founder' | 'text' | 'accentText' | 'textSecondary' };

  return (
    <View style={[styles.root, { borderColor: tone.border }]}>
      {kind === 'live' ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
      <Text variant="label" color={tone.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs + 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
