/**
 * UPZZY design tokens.
 *
 * Raw palette values live in `palette`. Screens and components must only use
 * the semantic `ColorTokens` returned by `useTheme()`, so that light and dark
 * mode (and any future brand refresh) only require changes in this file.
 */

export const palette = {
  ink: '#0E0E0E',
  carbon: '#171717',
  graphite: '#242424',
  steel: '#3A3A38',
  smoke: '#8C8A84',
  ash: '#5C5B57',
  stone: '#D9D5CC',
  bone: '#F2EFE8',
  paper: '#FFFFFF',
  signal: '#FF5A1F',
  signalDeep: '#C2410C',
  brass: '#C8A45A',
  brassDeep: '#8A6A22',
  go: '#3DBE7A',
  goDeep: '#1F7A4B',
  stop: '#F0565B',
  stopDeep: '#C42B30',
} as const;

export type ColorTokens = {
  /** Screen background. */
  background: string;
  /** Raised surfaces: sheets, rows, inputs. */
  surface: string;
  /** Surfaces on top of `surface`, pressed states. */
  surfaceStrong: string;
  /** Hairlines and outlines. */
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Brand accent: live states, primary actions, highlights. */
  accent: string;
  /** Text drawn on top of `accent`. */
  onAccent: string;
  /** Accent used as text on `background` (meets AA contrast). */
  accentText: string;
  /** First 100 founders. */
  founder: string;
  success: string;
  danger: string;
  /** Inverted block (e.g. black on bone in light mode). */
  inverse: string;
  onInverse: string;
  /** Accent used as text on `inverse`. */
  accentOnInverse: string;
};

export const colors: Record<'light' | 'dark', ColorTokens> = {
  dark: {
    background: palette.ink,
    surface: palette.carbon,
    surfaceStrong: palette.graphite,
    border: palette.steel,
    text: palette.bone,
    textSecondary: palette.stone,
    textMuted: palette.smoke,
    accent: palette.signal,
    onAccent: palette.ink,
    accentText: palette.signal,
    founder: palette.brass,
    success: palette.go,
    danger: palette.stop,
    inverse: palette.bone,
    onInverse: palette.ink,
    accentOnInverse: palette.signalDeep,
  },
  light: {
    background: palette.bone,
    surface: palette.paper,
    surfaceStrong: palette.stone,
    border: palette.stone,
    text: palette.ink,
    textSecondary: palette.steel,
    textMuted: palette.ash,
    accent: palette.signal,
    onAccent: palette.ink,
    accentText: palette.signalDeep,
    founder: palette.brassDeep,
    success: palette.goDeep,
    danger: palette.stopDeep,
    inverse: palette.ink,
    onInverse: palette.bone,
    accentOnInverse: palette.signal,
  },
};

/** 4pt grid. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

/** Mostly square: streetwear tags and labels, not soft app cards. */
export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  pill: 999,
} as const;

/** Font family names, registered in `src/app/_layout.tsx`. */
export const fonts = {
  display: 'Archivo_900Black',
  displayBold: 'Archivo_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 56, lineHeight: 54, letterSpacing: -1.5, textTransform: 'uppercase' },
  h1: { fontFamily: fonts.display, fontSize: 36, lineHeight: 36, letterSpacing: -0.8, textTransform: 'uppercase' },
  h2: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: 'uppercase' },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof type;

export const layout = {
  gutter: space.lg,
  maxContentWidth: 720,
  tabBarHeight: 64,
} as const;
