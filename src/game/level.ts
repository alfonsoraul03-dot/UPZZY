/**
 * "Spot the oops": a calm, perfect grid with exactly one deliberate mistake,
 * built from the UPZZY signature moves. Pure logic, no React, fully tested.
 */
import { pick, type Rng } from './rng';

export type Shape = 'circle' | 'square' | 'dot' | 'bar' | 'letter';

/**
 * slip        rotated a few degrees (like the second Z in UPZZY)
 * drop        knocked slightly out of line
 * misregister its outline moved up-right, like a print that shifted
 * flip        upside down, the "wrong side"
 */
export type Mistake = 'slip' | 'drop' | 'misregister' | 'flip';

export type Item = {
  /** Degrees. */
  rotate: number;
  /** Offsets as a fraction of the cell size. */
  dx: number;
  dy: number;
  /** Outline offset (misregistration), fraction of cell size. */
  outlineDx: number;
  outlineDy: number;
  flipped: boolean;
};

export type Level = {
  cols: number;
  rows: number;
  shape: Shape;
  /** Character drawn when `shape` is "letter". */
  glyph: string;
  /** Every item has a matching outline (only relevant for misregister levels). */
  outlined: boolean;
  mistake: Mistake;
  oopsIndex: number;
  items: Item[];
  /** Seconds allowed in timed modes. */
  timeLimit: number;
};

const MISTAKES_BY_SHAPE: Record<Shape, readonly Mistake[]> = {
  // Rotating a circle or dot is invisible, so they only slip out of line or misprint.
  circle: ['drop', 'misregister'],
  dot: ['drop'],
  square: ['slip', 'drop', 'misregister'],
  bar: ['slip', 'drop'],
  letter: ['slip', 'drop', 'flip'],
};

/** Letters that read clearly wrong when upside down. */
const GLYPHS = ['U', 'P', 'Z', 'Y'] as const;
const FLIPPABLE = ['U', 'P', 'Y'] as const;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 0 at the first round, 1 from round 20 on. */
export function difficulty(round: number): number {
  return Math.min(Math.max(round, 0) / 20, 1);
}

export function gridFor(round: number): { cols: number; rows: number } {
  const d = difficulty(round);
  const cols = d < 0.25 ? 3 : d < 0.7 ? 4 : 5;
  return { cols, rows: cols + 1 };
}

const PERFECT: Item = { rotate: 0, dx: 0, dy: 0, outlineDx: 0, outlineDy: 0, flipped: false };

export function generateLevel(rng: Rng, round: number): Level {
  const d = difficulty(round);
  const { cols, rows } = gridFor(round);
  const shape = pick(rng, ['circle', 'square', 'dot', 'bar', 'letter'] as const);
  const mistake = pick(rng, MISTAKES_BY_SHAPE[shape]);
  const glyph = mistake === 'flip' ? pick(rng, FLIPPABLE) : pick(rng, GLYPHS);
  const count = cols * rows;
  const oopsIndex = Math.floor(rng() * count);
  const sign = rng() < 0.5 ? -1 : 1;

  const oops: Item = { ...PERFECT };
  switch (mistake) {
    case 'slip':
      oops.rotate = sign * lerp(14, 5, d);
      break;
    case 'drop':
      if (rng() < 0.5) oops.dy = sign * lerp(0.18, 0.06, d);
      else oops.dx = sign * lerp(0.18, 0.06, d);
      break;
    case 'misregister': {
      const shift = lerp(0.16, 0.06, d);
      oops.outlineDx = shift;
      oops.outlineDy = -shift;
      break;
    }
    case 'flip':
      oops.flipped = true;
      break;
  }

  return {
    cols,
    rows,
    shape,
    glyph,
    outlined: mistake === 'misregister',
    mistake,
    oopsIndex,
    items: Array.from({ length: count }, (_, i) => (i === oopsIndex ? oops : { ...PERFECT })),
    timeLimit: Math.round(lerp(9, 4, d)),
  };
}

export const MISTAKE_LINES: Record<Mistake, string> = {
  slip: 'it slipped.',
  drop: 'knocked out of line.',
  misregister: 'the print moved.',
  flip: 'wrong side up.',
};
