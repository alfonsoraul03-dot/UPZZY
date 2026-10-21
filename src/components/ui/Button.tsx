import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  /** Lowercase, short, dry: "start", "again", "share". */
  label: string;
  variant?: 'solid' | 'outline';
  /** Shown before the label, like a sign-in logo. Gets the label colour. */
  icon?: (color: string) => React.ReactNode;
};

/** Buttons use the main thread colour. Oops Orange is reserved for mistakes. */
export function Button({ label, variant = 'solid', icon, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const solid = variant === 'solid';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: solid ? theme.text : 'transparent',
          borderColor: theme.text,
          opacity: disabled ? 0.4 : state.pressed ? 0.75 : 1,
          transform: [{ scale: state.pressed ? 0.98 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.row}>
        {icon?.(solid ? theme.onText : theme.text)}
        <Text style={[styles.label, { color: solid ? theme.onText : theme.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingHorizontal: space.xxl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
});
