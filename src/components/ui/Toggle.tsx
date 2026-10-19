import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { fonts, space, useTheme } from '@/theme';

import { Text } from './Text';

type ToggleProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Draw for a photo background (light text). */
  onPhoto?: boolean;
};

/** Two or three quiet words; the chosen one is bold. "global  friends". */
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
            hitSlop={8}>
            <Text style={{ color, opacity: selected ? 1 : 0.55, fontFamily: selected ? fonts.bodySemiBold : fonts.body, fontSize: 16 }}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl },
});
