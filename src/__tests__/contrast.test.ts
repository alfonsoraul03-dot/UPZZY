import { contrastRatio } from '@/theme/contrast';
import { colors, type ColorTokens } from '@/theme/tokens';

// WCAG AA: 4.5:1 for body text, 3:1 for large text and UI shapes.
const TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textMuted', 'background'],
  ['accentText', 'background'],
  ['onAccent', 'accent'],
  ['onInverse', 'inverse'],
  ['accentOnInverse', 'inverse'],
];
const UI_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['founder', 'background'],
  ['success', 'background'],
  ['danger', 'background'],
];

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  const theme = colors[scheme];

  it.each(TEXT_PAIRS)('%s on %s meets AA for text', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('%s on %s meets AA for UI elements', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(3);
  });
});

it('computes known ratios', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  expect(() => contrastRatio('red', '#fff')).toThrow();
});
