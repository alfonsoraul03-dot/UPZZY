import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/brand/icons';
import { Logo } from '@/components/brand/Logo';
import { EmptyState, Text } from '@/components/ui';
import { layout, space, useTheme } from '@/theme';

export default function StoreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Logo size={18} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close store"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <CloseIcon color={theme.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text variant="label" color="accentText">
          UPZZY Store
        </Text>
        <Text variant="h1">The shop{'\n'}opens soon.</Text>
        <Text color="textSecondary">
          Tees, hoodies, limited collections and creator-designed pieces. Products, prices and stock will come straight from the UPZZY store backend, so what
          you see here is always real.
        </Text>
        <EmptyState
          tag="Phase 8"
          title="No products listed"
          message="Checkout, order history and shipping updates are built in Phase 8. Payments go through a secure provider and card details never touch UPZZY servers."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 48,
    paddingHorizontal: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    padding: layout.gutter,
    paddingTop: space.xxl,
    gap: space.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
});
