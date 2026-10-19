/**
 * Public runtime configuration. Only `EXPO_PUBLIC_*` variables are available in
 * the app bundle, and anything here ships to every phone, so it must never
 * contain secrets such as the Supabase service-role key.
 */

export type PublicConfig =
  | { ok: true; supabaseUrl: string; supabaseAnonKey: string }
  | { ok: false; problems: string[] };

export function readPublicConfig(env: Record<string, string | undefined>): PublicConfig {
  const problems: string[] = [];
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!url) {
    problems.push('EXPO_PUBLIC_SUPABASE_URL is missing.');
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+):\d+\/?$/.test(url)) {
    problems.push('EXPO_PUBLIC_SUPABASE_URL should look like https://<project>.supabase.co');
  }

  if (!anonKey) {
    problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.');
  } else if (looksLikeServiceRoleKey(anonKey)) {
    problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is a service-role/secret key. Use the anon/publishable key instead.');
  }

  return problems.length ? { ok: false, problems } : { ok: true, supabaseUrl: url.replace(/\/$/, ''), supabaseAnonKey: anonKey };
}

/** Detects the two forms of Supabase secret key: `sb_secret_…` and legacy JWTs with role=service_role. */
export function looksLikeServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = decodeBase64Url(parts[1]);
    return /"role"\s*:\s*"service_role"/.test(json);
  } catch {
    return false;
  }
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const char of base64.replace(/=+$/, '')) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error('Invalid base64');
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

export const publicConfig = readPublicConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
