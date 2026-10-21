import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

let devEntry: Promise<Session | null> | null = null;

/**
 * Development only: open the app already inside, with an anonymous test
 * account, so there is no sign-in step while the app is being built.
 * Needs "Allow anonymous sign-ins" on in Supabase; if it is off, the normal
 * sign-in screens show instead. Never runs in the published app.
 */
function storedOrDevSession(): Promise<Session | null> {
  const db = supabase!;
  return db.auth.getSession().then(({ data }) => {
    if (data.session || !__DEV__) return data.session;
    devEntry ??= db.auth
      .signInAnonymously()
      .then(({ data: anon, error }) => {
        if (error) console.warn("dev sign-in skipped:", error.message);
        return anon.session ?? null;
      })
      .finally(() => {
        devEntry = null;
      });
    return devEntry;
  });
}

/** The signed-in session, or null. `ready` turns true once the stored session has been read. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    storedOrDevSession().then((s) => {
      setSession(s);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return {
    session,
    userId: session?.user.id ?? null,
    ready,
    configured: !!supabase,
  };
}
