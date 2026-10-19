import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type ColorTokens, type TypeVariant, type as typeScale, useTheme } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: keyof ColorTokens;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  return <RNText style={[typeScale[variant], { color: theme[color] }, style]} {...rest} />;
}
