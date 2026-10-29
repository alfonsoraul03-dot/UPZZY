import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { useBag } from '@/hooks/useBag';
import { bagCount } from '@/social/shop';
import { fonts, useTheme } from '@/theme';
import { duration, timing } from '@/theme/motion';

/** The bag icon with how many things are in it. */
export function BagButton({ color }: { color?: string }) {
  const theme = useTheme();
  const { bag } = useBag();
  const count = bagCount(bag);
  // The badge blooms when something goes in.
  const bloom = useSharedValue(1);
  const last = useRef(count);
  useEffect(() => {
    if (count > last.current) bloom.set(withSequence(withTiming(1.3, timing(duration.press)), withTiming(1, timing(duration.micro))));
    last.current = count;
  }, [count, bloom]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: bloom.value }] }));
  return (
    <Pressable
      onPress={() => router.push('/bag')}
      accessibilityRole="button"
      accessibilityLabel={count ? `bag, ${count} in it` : 'bag'}
      hitSlop={12}>
      <Icon name="bag" color={color ?? theme.text} />
      {count ? (
        <Animated.View style={[styles.badge, { backgroundColor: theme.text }, badge]}>
          <Text style={[styles.count, { color: theme.onText }]}>{count > 9 ? '9+' : count}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  count: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 },
});
