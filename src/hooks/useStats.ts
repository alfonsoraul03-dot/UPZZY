import { useCallback, useEffect, useState } from 'react';

import { EMPTY_STATS, loadStats, saveStats, type Stats } from '@/game/storage';

/** Local stats shared by the screens. Reloads when a screen comes back into focus. */
export function useStats() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setStats(await loadStats());
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(async (change: (current: Stats) => Stats) => {
    const next = change(await loadStats());
    setStats(next);
    await saveStats(next);
    return next;
  }, []);

  return { stats, loaded, update, reload };
}
