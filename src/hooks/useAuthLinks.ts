import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';

import { completeAuthLink } from '@/lib/social';

/**
 * Finishes signing in when the link from the sign-in email opens the app.
 * Returns the last problem (for example an expired link), or null.
 */
export function useAuthLinks() {
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    completeAuthLink(url)
      .then((signedIn) => signedIn && setProblem(null))
      .catch(() => setProblem('that link expired or was already used. ask for a new one.'));
  }, [url]);

  return problem;
}
