import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useBag } from '@/hooks/useBag';
import { bagCount } from '@/social/shop';
import { fonts, useTheme } from '@/theme';

/** The bag icon with how many things are in it. */
export function BagButton({ color }: { color?: string }) {
  const theme = useTheme();
  const { bag } = useBag();
  const count = bagCount(bag);
  return (
    <Pressable
      onPress={() => router.push('/bag')}
      accessibilityRole="button"
      accessibilityLabel={count ? `bag, ${count} in it` : 'bag'}
      hitSlop={12}>
      <Icon name="bag" color={color ?? theme.text} />
      {count ? (
        <View style={[styles.badge, { backgroundColor: theme.text }]}>
          <Text style={[styles.count, { color: theme.onText }]}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  count: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 },
});
