import { useEffect, useState } from 'react';

import { hasAccess } from '@/lib/social';

// Shared by every screen, so unlocking on one screen opens the whole app.
let known: { userId: string; access: boolean } | null = null;
const listeners = new Set<() => void>();

export function setAccess(userId: string, access: boolean) {
  known = { userId, access };
  listeners.forEach((l) => l());
}

/** Whether `userId` may use the app (bought a piece, or staff). `null` while checking. */
export function useAccess(userId: string | null): boolean | null {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId || known?.userId === userId) return;
    hasAccess().then(
      (access) => setAccess(userId, access),
      () => setAccess(userId, false),
    );
  }, [userId]);

  return userId && known?.userId === userId ? known.access : null;
}
