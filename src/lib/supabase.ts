import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { publicConfig } from './env';

/**
 * The single Supabase client for the app, or `null` when the backend is not
 * configured yet (see `.env.example`). Callers must handle `null` and show a
 * clear "not connected" state instead of pretending data loaded.
 */
export const supabase: SupabaseClient | null = publicConfig.ok
  ? createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
      auth: {
        storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Only refresh auth tokens while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type BackendStatus =
  | { state: 'not-configured'; problems: string[] }
  | { state: 'reachable' }
  | { state: 'unreachable'; message: string };

/** Real connectivity check against the configured project's Auth health endpoint. */
export async function checkBackend(fetchImpl: typeof fetch = fetch): Promise<BackendStatus> {
  if (!publicConfig.ok) return { state: 'not-configured', problems: publicConfig.problems };
  try {
    const res = await fetchImpl(`${publicConfig.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: publicConfig.supabaseAnonKey },
    });
    return res.ok ? { state: 'reachable' } : { state: 'unreachable', message: `HTTP ${res.status}` };
  } catch (error) {
    return { state: 'unreachable', message: error instanceof Error ? error.message : 'Network error' };
  }
}
