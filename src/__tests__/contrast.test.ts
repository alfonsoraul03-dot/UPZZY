import { contrastRatio } from '@/theme/contrast';
import { colors, type ColorTokens } from '@/theme/tokens';

// WCAG AA: 4.5:1 for body text, 3:1 for large text and graphics.
const TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onText', 'text'],
];
// Oops Orange marks shapes and glyphs, never body text, so it needs 3:1.
const GRAPHIC_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['oops', 'background'],
  ['oops', 'surface'],
];

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  const theme = colors[scheme];

  it.each(TEXT_PAIRS)('%s on %s meets AA for text', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)('%s on %s meets AA for graphics', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(3);
  });
});

it('computes known ratios', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  expect(() => contrastRatio('red', '#fff')).toThrow();
});

it('text on the photo scrim stays readable even over a white photo', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const { photoScrim, onPhoto } = colors[scheme];
    const [r, g, b, a] = photoScrim.match(/[\d.]+/g)!.map(Number);
    const over = (c: number) => Math.round(c * a + 255 * (1 - a));
    const hex = '#' + [r, g, b].map((c) => over(c).toString(16).padStart(2, '0')).join('');
    expect(contrastRatio(onPhoto, hex)).toBeGreaterThanOrEqual(4.5);
  }
});
