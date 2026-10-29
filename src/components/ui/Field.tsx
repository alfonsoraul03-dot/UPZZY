import { useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native';

import { fonts, layout, radius, space, useTheme } from '@/theme';

/** A single quiet text input. The border lights up while you type in it. */
export function Field({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.placeholder}
      selectionColor={theme.text}
      cursorColor={theme.text}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, { color: theme.text, borderColor: focused ? theme.focus : theme.border, backgroundColor: theme.surface }, style]}
      {...rest}
    />
  );
}

// On the web the browser draws its own focus ring; the border already shows focus.
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const styles = StyleSheet.create({
  input: {
    ...noWebOutline,
    minHeight: layout.controlHeight,
    // Lets fields share a row without pushing each other off screen.
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 17,
  },
});
