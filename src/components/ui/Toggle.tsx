import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { fonts, space, useTheme } from '@/theme';

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
            <Text style={[styles.label, onPhoto && [styles.shadow, { textShadowColor: theme.photoShadow }], { color, opacity: selected ? 1 : 0.6 }]}>{option}</Text>
            <View style={[styles.bar, { backgroundColor: selected ? color : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl, justifyContent: 'center' },
  item: { alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  shadow: { textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  bar: { width: 28, height: 3, borderRadius: 2 },
});
