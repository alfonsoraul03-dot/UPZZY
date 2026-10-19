import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { layout, space, useTheme } from '@/theme';

import { BagIcon } from './icons';
import { Logo } from './Logo';

type AppHeaderProps = {
  /** Screen title. When omitted the UPZZY lockup is shown instead. */
  title?: string;
};

/**
 * Top bar shared by every tab. The bag on the right is the single, consistent
 * entry point to the UPZZY Store.
 */
export function AppHeader({ title }: AppHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { borderBottomColor: theme.border }]}>
      <View style={styles.inner}>
        {title ? <Text variant="h2">{title}</Text> : <Logo />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the UPZZY Store"
          hitSlop={12}
          onPress={() => router.push('/store')}
          style={({ pressed }) => [styles.store, { borderColor: theme.text, opacity: pressed ? 0.6 : 1 }]}>
          <BagIcon size={18} color={theme.text} />
          <Text variant="label">Store</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: {
    height: 56,
    paddingHorizontal: layout.gutter,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  store: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    height: 34,
  },
});
