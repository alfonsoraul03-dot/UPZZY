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
  /** Primary button fill, and the label on it. */
  primary: string;
  onPrimary: string;
  /** Buttons that cannot be pressed yet: a quiet fill, not a faded copy. */
  disabled: string;
  onDisabled: string;
  /** Hint text inside an empty field. */
  placeholder: string;
  /** Border of the field you are typing in. */
  focus: string;
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
    primary: palette.washedBlack,
    onPrimary: palette.chalk,
    disabled: '#DCD7CC',
    onDisabled: '#6E685F',
    placeholder: '#857F75',
    focus: palette.washedBlack,
  },
  // The app is dark, like BeReal and TikTok: photos carry the colour.
  // Warm black and warm white rather than pure, so it reads as a fashion label, not a terminal.
  dark: {
    background: '#080808',
    surface: '#141414',
    border: '#292929',
    text: '#F7F6F3',
    textMuted: '#A6A39F',
    oops: palette.oops,
    onText: '#101010',
    photoScrim: 'rgba(0, 0, 0, 0.6)',
    onPhoto: '#F7F6F3',
    photoShadow: 'rgba(0, 0, 0, 0.45)',
    primary: '#F5F4F0',
    onPrimary: '#101010',
    disabled: '#343434',
    onDisabled: '#898989',
    placeholder: '#6F6C68',
    focus: '#F7F6F3',
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
  /** Buttons and fields: rounded, not pills. */
  control: 12,
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

/**
 * One family, few weights: bold only for headlines, regular for reading.
 * Sizes are for a ~390pt-wide phone; `hero` steps down on narrow screens (see Hero).
 */
export const type = {
  /** Big numbers: scores, streaks. */
  number: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, letterSpacing: -1 },
  /** The one big line of an onboarding screen. */
  hero: { fontFamily: fonts.bodyBold, fontSize: 36, lineHeight: 41, letterSpacing: -1.1 },
  /** Screen titles: "not out yet.", "october". */
  heading: { fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  /** Supporting paragraphs under a headline. */
  lead: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, letterSpacing: -0.1 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 24 },
  /** Button labels. */
  button: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
} as const;

export type TypeVariant = keyof typeof type;

export const layout = {
  gutter: space.xl,
  /** Buttons and fields share one height, comfortably over the 44pt touch minimum. */
  controlHeight: 54,
  maxContentWidth: 560,
  tabBarHeight: 62,
} as const;
