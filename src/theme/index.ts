import { useColorScheme } from 'react-native';

import { colors, type ColorTokens } from './tokens';

export * from './tokens';

export function useTheme(): ColorTokens {
  return colors[useColorScheme() === 'light' ? 'light' : 'dark'];
}

export function useIsDark(): boolean {
  return useColorScheme() !== 'light';
}
