/**
 * Validation rules shared with the database. The SQL check constraints in
 * `supabase/migrations` are the source of truth; these mirror them so the app
 * can give instant feedback. Keep both in sync.
 */

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,22})[a-z0-9]$/;
export const BIO_MAX = 160;
export const CITY_MAX = 60;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): string | null {
  const value = normalizeUsername(input);
  if (value.length < 3) return 'Usernames need at least 3 characters.';
  if (value.length > 24) return 'Usernames can have at most 24 characters.';
  if (!USERNAME_PATTERN.test(value)) {
    return 'Use letters, numbers, "_" or "." and start and end with a letter or number.';
  }
  if (/[_.]{2}/.test(value)) return 'Avoid two symbols in a row.';
  return null;
}
