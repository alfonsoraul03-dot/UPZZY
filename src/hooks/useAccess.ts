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
    // No connection is not a "no": keep checking instead of asking a member for a code again.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const check = (wait: number) =>
      hasAccess().then(
        (access) => {
          if (!stopped) setAccess(userId, access);
        },
        () => {
          if (!stopped) timer = setTimeout(() => check(Math.min(wait * 2, 30000)), wait);
        },
      );
    check(2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [userId]);

  return userId && known?.userId === userId ? known.access : null;
}
