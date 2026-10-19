import { useColorScheme } from 'react-native';

import { colors, type ColorTokens } from './tokens';

export * from './tokens';

/** Light (Bone) is the brand default; dark mode follows the phone setting. */
export function useTheme(): ColorTokens {
  return colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
