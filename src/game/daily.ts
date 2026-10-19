import { generateLevel, type Level } from './level';
import { hashString, mulberry32 } from './rng';

export const DAILY_ROUNDS = 10;
/** Daily #1. */
export const DAILY_EPOCH = '2026-10-19';

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}

export function dailyNumber(key: string): number {
  return daysBetween(DAILY_EPOCH, key) + 1;
}

/** The same ten levels for everyone on a given date, getting harder each round. */
export function dailyLevels(key: string): Level[] {
  const rng = mulberry32(hashString(`upzzy-daily-${key}`));
  return Array.from({ length: DAILY_ROUNDS }, (_, i) => generateLevel(rng, i * 2));
}

/** Streak after finishing the daily on `today`. */
export function nextStreak(lastPlayed: string | null, streak: number, today: string): number {
  if (!lastPlayed) return 1;
  const gap = daysBetween(lastPlayed, today);
  if (gap <= 0) return Math.max(streak, 1);
  if (gap === 1) return streak + 1;
  return 1;
}

/** Streak to show before today's daily is played (it drops to 0 after a missed day). */
export function visibleStreak(lastPlayed: string | null, streak: number, today: string): number {
  if (!lastPlayed) return 0;
  return daysBetween(lastPlayed, today) <= 1 ? streak : 0;
}

export type DailyResult = {
  date: string;
  /** One entry per round: true when found on the first tap. */
  rounds: boolean[];
  seconds: number;
};

export function shareText(result: DailyResult): string {
  const found = result.rounds.filter(Boolean).length;
  const row = result.rounds.map((clean) => (clean ? '⬛' : '🟧')).join('');
  return `upzzy daily oops #${dailyNumber(result.date)}\n${row}\n${found}/${result.rounds.length} clean · ${result.seconds}s\nno undo. upzzyworld.com`;
}
