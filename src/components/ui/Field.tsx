import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { fonts, radius, space, useTheme } from '@/theme';

/** A single quiet text input. */
export function Field({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      selectionColor={theme.text}
      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 17,
  },
});
