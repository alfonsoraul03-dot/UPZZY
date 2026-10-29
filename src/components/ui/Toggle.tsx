import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { fonts, space, useTheme } from '@/theme';
import { duration, timing } from '@/theme/motion';

import { Text } from './Text';

type ToggleProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Draw for a photo background (white text with a soft shadow). */
  onPhoto?: boolean;
};

/** Bold words with a bar under the chosen one, like "friends | global" on TikTok. */
export function Toggle<T extends string>({ options, value, onChange, onPhoto }: ToggleProps<T>) {
  const theme = useTheme();
  const color = onPhoto ? theme.onPhoto : theme.text;
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => {
              if (selected) return;
              haptic('tap');
              onChange(option);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={10}
            style={styles.item}>
            <Choice selected={selected} color={color}>
              <Text style={[styles.label, onPhoto && [styles.shadow, { textShadowColor: theme.photoShadow }], { color }]}>{option}</Text>
            </Choice>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The chosen word comes forward and its bar grows in; the other steps back. */
function Choice({ selected, color, children }: { selected: boolean; color: string; children: React.ReactNode }) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, timing(duration.micro)));
  }, [selected, on]);
  const word = useAnimatedStyle(() => ({ opacity: 0.55 + on.value * 0.45 }));
  const bar = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: 0.4 + on.value * 0.6 }] }));
  return (
    <>
      <Animated.View style={word}>{children}</Animated.View>
      <Animated.View style={[styles.bar, { backgroundColor: color }, bar]} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl, justifyContent: 'center' },
  item: { alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
  shadow: { textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  bar: { width: 28, height: 3, borderRadius: 2 },
});
