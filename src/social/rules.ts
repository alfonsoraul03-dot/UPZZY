/**
 * Rules for the photo challenge that the app checks before talking to the
 * server. The database (supabase/migrations) is the source of truth and
 * enforces all of them again; keep both in sync.
 */

export const CAPTION_MAX = 80;

export type FeedScope = 'global' | 'friends';

export type FeedPost = {
  id: string;
  user_id: string;
  username: string | null;
  image_path: string;
  caption: string | null;
  like_count: number;
  created_at: string;
  liked: boolean;
  following: boolean;
};

export function normalizeCaption(input: string): string | null {
  const value = input.trim().replace(/\s+/g, ' ');
  return value ? value.slice(0, CAPTION_MAX) : null;
}

/** Photos go in the uploader's own folder: `<user>/<challenge>-<random>.jpg`. */
export function photoPath(userId: string, challengeId: string, random: string): string {
  return `${userId}/${challengeId}-${random.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'photo'}.jpg`;
}

/** New accounts get `member` + 12 hex characters until they pick a name. */
export function isPlaceholderUsername(username: string | null | undefined): boolean {
  return !username || /^member[0-9a-f]{12}$/.test(username);
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Supabase sends 6 to 10 digit codes depending on the project setting. */
export function isLoginCode(input: string): boolean {
  return /^\d{6,10}$/.test(input.trim());
}

/** Optimistic like toggle; the server keeps the real count. */
export function toggleLike(post: FeedPost): FeedPost {
  return post.liked
    ? { ...post, liked: false, like_count: Math.max(0, post.like_count - 1) }
    : { ...post, liked: true, like_count: post.like_count + 1 };
}

export const DOUBLE_TAP_MS = 280;

export function isDoubleTap(lastTapAt: number, now: number): boolean {
  return now - lastTapAt > 0 && now - lastTapAt <= DOUBLE_TAP_MS;
}

/** "12 likes", "1 like", "no likes yet". */
export function likesLabel(count: number): string {
  if (count <= 0) return 'no likes yet';
  return count === 1 ? '1 like' : `${count} likes`;
}

export function displayName(username: string | null): string {
  return username && !isPlaceholderUsername(username) ? `@${username}` : 'someone';
}
