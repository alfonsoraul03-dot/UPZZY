/**
 * UPZZY design tokens, from the brand DNA: calm, clean, minimal, with one
 * deliberate mistake. Oops Orange is ONLY used to mark the mistake (the
 * slipped Z, the shape you found, a lost life). Never for buttons or chrome.
 *
 * Screens use the semantic `ColorTokens` from `useTheme()`, never `palette`.
 */

export const palette = {
  bone: '#ECE6D8',
  chalk: '#F2F0EA',
  oatmeal: '#D9CDB8',
  washedBlack: '#2E2C2A',
  deepBlack: '#1E1D1B',
  slate: '#5E6873',
  stoneGrey: '#6B665E',
  dust: '#A39D92',
  skyWash: '#A9C1D3',
  navyWash: '#2F3A4C',
  butter: '#EAD9A2',
  moss: '#6E7559',
  oops: '#E4572E',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export type ColorTokens = {
  background: string;
  /** Slightly raised areas: the game board, cards. */
  surface: string;
  border: string;
  /** Main thread colour: text, shapes, primary buttons. */
  text: string;
  textMuted: string;
  /** Oops Orange. Only for the mistake. */
  oops: string;
  /** Text and icons drawn on a `text`-coloured fill (primary buttons). */
  onText: string;
  /** Flat band laid over photos so text on them stays readable. */
  photoScrim: string;
  /** Text on top of a photo scrim. */
  onPhoto: string;
  /** Soft shadow under white text drawn straight on a photo. */
  photoShadow: string;
};

/** Backgrounds for the initial-letter avatars, picked by name. Black text sits on all of them. */
export const avatarColors = [palette.butter, palette.skyWash, palette.oatmeal, palette.bone, '#C9B8E8', '#B8E0C9'] as const;

export const colors: Record<'light' | 'dark', ColorTokens> = {
  // Chalk rather than Bone as the page so Oops Orange keeps 3:1 contrast.
  light: {
    background: palette.chalk,
    surface: '#FAF8F3',
    border: palette.oatmeal,
    text: palette.washedBlack,
    textMuted: palette.stoneGrey,
    oops: palette.oops,
    onText: palette.bone,
    photoScrim: 'rgba(30, 29, 27, 0.7)',
    onPhoto: palette.chalk,
    photoShadow: 'rgba(0, 0, 0, 0.45)',
  },
  // The app is dark, like BeReal and TikTok: photos carry the colour.
  dark: {
    background: palette.black,
    surface: '#141414',
    border: '#262626',
    text: palette.white,
    textMuted: '#8E8E8E',
    oops: palette.oops,
    onText: palette.black,
    photoScrim: 'rgba(0, 0, 0, 0.55)',
    onPhoto: palette.white,
    photoShadow: 'rgba(0, 0, 0, 0.45)',
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

export const radius = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 14,
  xl: 22,
  pill: 999,
} as const;

/** Font family names, registered in `src/app/_layout.tsx`. */
export const fonts = {
  /** Bold, wide capitals: the logo and big numbers only. */
  display: 'Archivo_900Black',
  /** Small, quiet lowercase for everything else. */
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyHeavy: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const type = {
  /** Big numbers: scores, streaks. */
  number: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, letterSpacing: -1 },
  /** Big screen titles: "messages", "october". */
  heading: { fontFamily: fonts.bodyHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
} as const;

export type TypeVariant = keyof typeof type;

export const layout = {
  gutter: space.xl,
  maxContentWidth: 560,
  tabBarHeight: 62,
} as const;
