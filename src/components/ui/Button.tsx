import { Pressable, StyleSheet, View, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { layout, radius, space, type as typeScale, useTheme } from '@/theme';
import { duration, timing } from '@/theme/motion';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const RESTING: PressableStateCallbackType = { pressed: false, hovered: false };

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
 * state, not a faded copy. Pressing sinks it slightly, on the UI thread.
 * Oops Orange is reserved for mistakes.
 */
export function Button({ label, variant = 'solid', icon, disabled, style, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const theme = useTheme();
  const solid = variant === 'solid';
  const fill = disabled ? theme.disabled : solid ? theme.primary : theme.surface;
  const ink = disabled ? theme.onDisabled : solid ? theme.onPrimary : theme.text;
  const pressed = useSharedValue(0);
  const feel = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.12,
    transform: [{ scale: 1 - pressed.value * 0.025 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.set(withTiming(1, timing(duration.press)));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withTiming(0, timing(duration.release)));
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        { backgroundColor: fill, borderColor: solid || disabled ? fill : theme.border },
        typeof style === 'function' ? style(RESTING) : style,
        feel,
      ]}
      {...rest}>
      <View style={styles.row}>
        {icon?.(ink)}
        <Text style={[typeScale.button, { color: ink }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
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
