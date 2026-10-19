import {
  dailyLevels,
  dailyNumber,
  dateKey,
  nextStreak,
  shareText,
  visibleStreak,
} from '@/game/daily';
import { generateLevel, gridFor, type Item } from '@/game/level';
import { hashString, mulberry32 } from '@/game/rng';

const isPerfect = (item: Item) =>
  item.rotate === 0 && item.dx === 0 && item.dy === 0 && item.outlineDx === 0 && item.outlineDy === 0 && !item.flipped;

describe('generateLevel', () => {
  const rng = mulberry32(42);
  const levels = Array.from({ length: 500 }, (_, i) => generateLevel(rng, i % 30));

  it('always has exactly one mistake, at oopsIndex', () => {
    for (const level of levels) {
      expect(level.items).toHaveLength(level.cols * level.rows);
      const imperfect = level.items.map((item, i) => (isPerfect(item) ? -1 : i)).filter((i) => i >= 0);
      expect(imperfect).toEqual([level.oopsIndex]);
    }
  });

  it('only uses mistakes that are visible on the shape', () => {
    for (const level of levels) {
      if (level.shape === 'circle' || level.shape === 'dot') expect(level.mistake).not.toBe('slip');
      if (level.mistake === 'flip') {
        expect(level.shape).toBe('letter');
        expect(['U', 'P', 'Y']).toContain(level.glyph);
      }
      if (level.mistake === 'misregister') expect(level.outlined).toBe(true);
    }
  });

  it('gets subtler and bigger as rounds go on', () => {
    expect(gridFor(0)).toEqual({ cols: 3, rows: 4 });
    expect(gridFor(25)).toEqual({ cols: 5, rows: 6 });
    const slips = (round: number) => {
      const r = mulberry32(7);
      const out: number[] = [];
      while (out.length < 20) {
        const level = generateLevel(r, round);
        if (level.mistake === 'slip') out.push(Math.abs(level.items[level.oopsIndex].rotate));
      }
      return Math.max(...out);
    };
    expect(slips(0)).toBeGreaterThan(slips(20));
    expect(slips(20)).toBeGreaterThanOrEqual(5);
    expect(generateLevel(mulberry32(1), 0).timeLimit).toBeGreaterThan(generateLevel(mulberry32(1), 20).timeLimit);
  });
});

describe('daily', () => {
  it('is the same puzzle for everyone on the same day, and different tomorrow', () => {
    expect(dailyLevels('2026-10-20')).toEqual(dailyLevels('2026-10-20'));
    expect(dailyLevels('2026-10-20')).not.toEqual(dailyLevels('2026-10-21'));
    expect(dailyLevels('2026-10-20')).toHaveLength(10);
  });

  it('numbers days from launch', () => {
    expect(dailyNumber('2026-10-19')).toBe(1);
    expect(dailyNumber('2026-11-01')).toBe(14);
    expect(dailyNumber('2027-01-01')).toBe(75);
  });

  it('formats local dates', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('keeps, grows and resets streaks', () => {
    expect(nextStreak(null, 0, '2026-10-19')).toBe(1);
    expect(nextStreak('2026-10-19', 3, '2026-10-20')).toBe(4);
    expect(nextStreak('2026-10-20', 4, '2026-10-20')).toBe(4);
    expect(nextStreak('2026-10-18', 9, '2026-10-20')).toBe(1);
    expect(nextStreak('2026-12-31', 2, '2027-01-01')).toBe(3);
    expect(visibleStreak('2026-10-19', 5, '2026-10-20')).toBe(5);
    expect(visibleStreak('2026-10-17', 5, '2026-10-20')).toBe(0);
  });

  it('shares a spoiler-free result', () => {
    const text = shareText({ date: '2026-10-20', rounds: [true, true, false, true, true, true, true, true, true, true], seconds: 41 });
    expect(text).toContain('#2');
    expect(text).toContain('9/10 clean · 41s');
    expect(text).toContain('⬛⬛🟧⬛');
  });
});

it('hashes strings deterministically', () => {
  expect(hashString('oops')).toBe(hashString('oops'));
  expect(hashString('oops')).not.toBe(hashString('oopz'));
});
