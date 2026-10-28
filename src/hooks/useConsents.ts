import { useEffect, useSyncExternalStore } from 'react';

import { getMyConsents, type Consents } from '@/lib/social';

// Shared by every screen, so answering on one screen moves the whole app on.
let known: { userId: string; consents: Consents } | null = null;
let loading: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Fetches the answers again, for example right after answering. */
export async function refreshConsents(userId: string): Promise<Consents> {
  const consents = await getMyConsents();
  known = { userId, consents };
  emit();
  return consents;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => known;

/** Your answers about age, photo rules and social media. `null` while loading. */
export function useConsents(userId: string | null): Consents | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!userId || known?.userId === userId || loading === userId) return;
    loading = userId;
    refreshConsents(userId)
      .catch(() => {
        // Keep loading; the next screen focus tries again.
      })
      .finally(() => {
        loading = null;
      });
  }, [userId]);

  return userId && current?.userId === userId ? current.consents : null;
}
