import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyResult } from './daily';

/**
 * Progress is stored on this phone only. Nothing here is a prize or a
 * verified score: real rewards will need server-side checks.
 */
export type Stats = {
  streak: number;
  lastDaily: string | null;
  daily: DailyResult | null;
};

const KEY = 'upzzy.stats.v1';

export const EMPTY_STATS: Stats = { streak: 0, lastDaily: null, daily: null };

export async function loadStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_STATS, ...JSON.parse(raw) } : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Losing local progress is not worth crashing the game over.
  }
}
