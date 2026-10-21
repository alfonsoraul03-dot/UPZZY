import { colors, type ColorTokens } from './tokens';

export * from './tokens';

/** The app is dark for now, whatever the phone setting. Light tokens stay for later. */
export function useTheme(): ColorTokens {
  return colors.dark;
}

export function useIsDark(): boolean {
  return true;
}
