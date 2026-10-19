import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'inverse' | 'outline';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Optional element rendered before the label, usually an icon. */
  leading?: React.ReactNode;
};

export function Button({ label, variant = 'primary', loading, disabled, leading, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const fill = {
    primary: { bg: theme.accent, fg: 'onAccent', border: theme.accent },
    inverse: { bg: theme.inverse, fg: 'onInverse', border: theme.inverse },
    outline: { bg: 'transparent', fg: 'text', border: theme.text },
  }[variant] as { bg: string; fg: 'onAccent' | 'onInverse' | 'text'; border: string };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        { backgroundColor: fill.bg, borderColor: fill.border, opacity: isDisabled ? 0.45 : state.pressed ? 0.8 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme[fill.fg]} />
      ) : (
        <View style={styles.row}>
          {leading}
          <Text variant="label" color={fill.fg} style={styles.label}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontSize: 13, letterSpacing: 1.6 },
});
