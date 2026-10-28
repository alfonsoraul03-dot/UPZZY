/**
 * Rules for the photo challenge that the app checks before talking to the
 * server. The database (supabase/migrations) is the source of truth and
 * enforces all of them again; keep both in sync.
 */

export const CAPTION_MAX = 80;

export type FeedScope = 'global' | 'friends';

/** Staff check every photo for an UPZZY piece; only approved photos earn points. */
export type Review = 'pending' | 'approved' | 'rejected';

/** Each like on a checked photo, and each friend, adds points. Mirrors `scores_since`. */
export const POINTS_PER_LIKE = 1;
export const POINTS_PER_FRIEND = 10;
/** The most a challenge can be worth. Mirrors `random_max_points()`. */
export const CHALLENGE_MAX_POINTS = 500;
/** Top of the global ranking each month wins a free piece (checked by staff). */
export const PRIZE_PLACES = 3;

export type Reaction = { user_id: string; username: string | null; image_path: string };

export type FeedPost = {
  id: string;
  user_id: string;
  username: string | null;
  image_path: string;
  caption: string | null;
  points: number;
  review: Review;
  like_count: number;
  liked: boolean;
  created_at: string;
  following: boolean;
  reaction_count: number;
  reactions: Reaction[];
  my_reaction: string | null;
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

export const DOUBLE_TAP_MS = 280;

export function isDoubleTap(lastTapAt: number, now: number): boolean {
  return now - lastTapAt > 0 && now - lastTapAt <= DOUBLE_TAP_MS;
}

export function displayName(username: string | null): string {
  return username && !isPlaceholderUsername(username) ? `@${username}` : 'someone';
}

/** Reaction photos: `<user>/r-<post>-<random>.jpg`, matching `react_to_post`. */
export function reactionPath(userId: string, postId: string, random: string): string {
  return `${userId}/r-${postId}-${random.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'photo'}.jpg`;
}

/**
 * Points for posting `minutes` after the drop on a challenge worth `max`
 * (100 to 500): all of it in the first 5 minutes, then 1% less every 5
 * minutes, never below 10%. The server (`post_points`) decides; this is only
 * for showing what a photo is worth right now.
 */
export function pointsFor(minutes: number, max = 100): number {
  const share = Math.max(10, 100 - Math.floor(Math.max(minutes - 5, 0) / 5));
  return Math.round((max * share) / 100);
}

/** The line on a photo: its points, or why they do not count (yet). */
export function pointsLabel(points: number, review: Review, late: string): string {
  if (review === 'rejected') return 'no upzzy · 0 pts';
  if (review === 'pending') return `+${points} pts · upzzy check pending`;
  return `+${points} pts · ${late}`;
}

export function minutesBetween(from: string | Date, to: string | Date): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

/** "2 min after the drop", "3 h after the drop". */
export function lateLabel(minutes: number): string {
  if (minutes < 1) return 'right at the drop';
  if (minutes < 60) return `${Math.floor(minutes)} min after the drop`;
  return `${Math.floor(minutes / 60)} h after the drop`;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Month name in Madrid time, matching the server's ranking month. */
export function monthName(date: Date): string {
  const month = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', month: 'numeric' }).format(date));
  return MONTHS[month - 1];
}

/** "oct 19" for a YYYY-MM-DD challenge day. */
export function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

export function streakLabel(days: number): string {
  return days === 1 ? '1 day streak' : `${days} day streak`;
}

