import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { layout, radius, space, type as typeScale, useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  /** Lowercase, short, dry: "start", "again", "share". */
  label: string;
  variant?: 'solid' | 'outline';
  /** Shown before the label, like a sign-in logo. Gets the label colour. */
  icon?: (color: string) => React.ReactNode;
};

/**
 * Solid: warm white fill, the one main action. Outline: a quiet dark fill
 * with a hairline border, for the other choice. Disabled is its own grey
 * state, not a faded copy. Oops Orange is reserved for mistakes.
 */
export function Button({ label, variant = 'solid', icon, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const solid = variant === 'solid';
  const fill = disabled ? theme.disabled : solid ? theme.primary : theme.surface;
  const ink = disabled ? theme.onDisabled : solid ? theme.onPrimary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: fill,
          borderColor: solid || disabled ? fill : theme.border,
          opacity: state.pressed ? 0.86 : 1,
          transform: [{ scale: state.pressed ? 0.985 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.row}>
        {icon?.(ink)}
        <Text style={[typeScale.button, { color: ink }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.controlHeight,
    paddingHorizontal: space.xl,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, maxWidth: '100%' },
});
