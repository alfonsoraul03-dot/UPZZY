import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { normalizeCaption, normalizeMessage, photoPath, reactionPath, type FeedPost, type FeedScope, type Review } from '@/social/rules';

import { parseAuthLink } from './authLink';
import { forgetPush } from './push';
import { supabase } from './supabase';

/**
 * Everything the photo challenge asks of the backend. Every rule (one post a
 * day, own folder, counts, visibility) is enforced again by the database.
 */

export type Challenge = {
  id: string;
  day: string;
  opens_at: string;
  title: string;
  description: string | null;
  reward: string | null;
  /** What the challenge is worth if you post right away (100 to 500). */
  max_points: number;
};

/** Today's challenge, or just `{ is_open: false }` while it is still a secret. */
export type Today = ({ is_open: true } & Challenge) | { is_open: false; day: string };

export type UserStats = {
  username: string | null;
  streak: number;
  month_points: number;
  total_points: number;
  /** Points of photos still waiting for the UPZZY check. */
  pending_points: number;
  posts: number;
  friends: number;
  following: boolean;
};

export type ProfilePost = {
  id: string;
  image_path: string;
  points: number;
  review: Review;
  challenges: { day: string; title: string } | null;
};

export type RankRow = { rank: number; user_id: string; username: string | null; points: number; posts: number };

export type Profile = { id: string; username: string };

export type Message = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null };

export type Chat = {
  user_id: string;
  username: string | null;
  last_body: string | null;
  last_at: string | null;
  last_from_me: boolean;
  unread: number;
  is_friend: boolean;
};

const BUCKET = 'oops';

function client() {
  if (!supabase) throw new Error('not connected');
  return supabase;
}

/** Turns database errors into short lines for the screen. */
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505') return 'already done.';
  if (e?.code === 'over_email_send_rate_limit' || (e as { status?: number } | null)?.status === 429) {
    return 'too many emails for now. try again in an hour.';
  }
  if (e?.code === '54000') return 'slow down a little.';
  if (e?.message === 'You can only message friends') return 'only friends can message each other.';
  if (e?.message === 'Unlock upzzy with the code from your piece') return 'unlock upzzy with the code from your package first.';
  if (e?.message?.includes('provider is not enabled')) return 'this sign-in is not switched on in supabase yet.';
  if (e?.code === 'anonymous_provider_disabled') return 'turn on anonymous sign-ins in supabase first.';
  if (e?.message?.includes('This challenge is closed')) return 'this challenge closed. new one is up.';
  if (e?.message === 'not connected') return 'not connected yet.';
  if (e?.message?.toLowerCase().includes('network')) return 'no connection. try again.';
  return "didn't go through. try again.";
}

export async function getToday(): Promise<Today | null> {
  const { data, error } = await client().rpc('today_challenge');
  if (error) throw error;
  const row = (data as (Challenge & { is_open: boolean })[] | null)?.[0];
  if (!row) return null;
  return row.is_open ? { ...row, is_open: true } : { is_open: false, day: row.day };
}

/** The newest challenge that is out: today's, or yesterday's while today's is a secret. */
export async function getLatestChallenge(): Promise<Challenge | null> {
  const { data, error } = await client().rpc('latest_challenge');
  if (error) throw error;
  return ((data as Challenge[] | null) ?? [])[0] ?? null;
}

export async function getFeed(challengeId: string, scope: FeedScope, before?: string): Promise<FeedPost[]> {
  const { data, error } = await client().rpc('challenge_feed', {
    p_challenge_id: challengeId,
    p_scope: scope,
    p_before: before ?? null,
    p_limit: 12,
  });
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

/** Short-lived links to photos. The bucket is private, so hidden posts stay hidden. */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await client().storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

export async function setFollowing(userId: string, following: boolean, me: string): Promise<void> {
  const db = client();
  const { error } = following
    ? await db.from('follows').insert({ followed_id: userId })
    : await db.from('follows').delete().eq('follower_id', me).eq('followed_id', userId);
  if (error && error.code !== '23505') throw error;
}

export async function reportPost(postId: string, reason: 'spam' | 'nudity' | 'hate' | 'violence' | 'other'): Promise<void> {
  const { error } = await client().from('post_reports').insert({ post_id: postId, reason });
  if (error && error.code !== '23505') throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await client().from('user_blocks').insert({ blocked_id: userId });
  if (error && error.code !== '23505') throw error;
}

/** Has the signed-in user already posted to this challenge? */
export async function myPost(challengeId: string, me: string): Promise<{ id: string; image_path: string } | null> {
  const { data, error } = await client()
    .from('posts')
    .select('id, image_path')
    .eq('challenge_id', challengeId)
    .eq('user_id', me)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function readPhoto(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** Uploads a front-camera photo as your reaction, replacing (and deleting) an earlier one. */
export async function reactWithPhoto(postId: string, me: string, uri: string): Promise<void> {
  const db = client();
  const path = reactionPath(me, postId, Math.random().toString(36).slice(2));
  const upload = await db.storage.from(BUCKET).upload(path, await readPhoto(uri), { contentType: 'image/jpeg', upsert: false });
  if (upload.error) throw upload.error;
  const { data: oldPath, error } = await db.rpc('react_to_post', { p_post_id: postId, p_image_path: path });
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  if (typeof oldPath === 'string') await db.storage.from(BUCKET).remove([oldPath]);
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await client().rpc('user_stats', { p_user_id: userId });
  if (error) throw error;
  return ((data as UserStats[] | null) ?? [])[0] ?? null;
}

export async function getUserPosts(userId: string): Promise<ProfilePost[]> {
  const { data, error } = await client()
    .from('posts')
    .select('id, image_path, points, review, challenges(day, title)')
    .eq('user_id', userId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as ProfilePost[];
}

export async function getRanking(scope: FeedScope): Promise<RankRow[]> {
  const { data, error } = await client().rpc('monthly_ranking', { p_scope: scope, p_limit: 100 });
  if (error) throw error;
  return (data ?? []) as RankRow[];
}

/** Uploads a camera photo and posts it. Removes the upload again if posting fails. */
export async function submitPhoto(challengeId: string, me: string, uri: string, caption: string): Promise<void> {
  const db = client();
  const path = photoPath(me, challengeId, Math.random().toString(36).slice(2));
  const body = await readPhoto(uri);
  const upload = await db.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (upload.error) throw upload.error;
  const { error } = await db.rpc('submit_post', {
    p_challenge_id: challengeId,
    p_image_path: path,
    p_caption: normalizeCaption(caption),
  });
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function deletePost(postId: string, imagePath: string): Promise<void> {
  const db = client();
  const { error } = await db.from('posts').delete().eq('id', postId);
  if (error) throw error;
  await db.storage.from(BUCKET).remove([imagePath]);
}

export async function getMyProfile(me: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('id, username').eq('id', me).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setUsername(me: string, username: string): Promise<void> {
  const { error } = await client().from('profiles').update({ username }).eq('id', me);
  if (error) throw error;
}

export async function sendLoginCode(email: string): Promise<void> {
  // The email has a link back into the app and, if the template includes it, a code.
  const { error } = await client().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('/account') },
  });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

/** Signs in from the email link once it opens the app. Returns false for links that are not sign-in links. */
export async function completeAuthLink(url: string): Promise<boolean> {
  const link = parseAuthLink(url);
  if (!link || !supabase) return false;
  if (link.kind === 'error') throw new Error(link.message);
  const { error } =
    link.kind === 'tokens'
      ? await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
      : await supabase.auth.exchangeCodeForSession(link.code);
  if (error) throw error;
  return true;
}

/**
 * Development only: enter without an email to try the app. Creates a real but
 * anonymous account. Needs "Allow anonymous sign-ins" on in Supabase.
 */
export async function signInWithoutEmail(): Promise<void> {
  const { error } = await client().auth.signInAnonymously();
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await forgetPush().catch(() => {});
  await client().auth.signOut();
}

/** Removes the user's photos, then the account (profile, posts, likes, follows cascade). */
export async function deleteAccount(me: string): Promise<void> {
  const db = client();
  const { data: files } = await db.storage.from(BUCKET).list(me, { limit: 1000 });
  if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => `${me}/${f.name}`));
  const { error } = await db.rpc('delete_account');
  if (error) throw error;
  await db.auth.signOut();
}

/** Shares your photo to Instagram, TikTok, WhatsApp… through the phone's share sheet. */
export async function sharePhoto(url: string, postId: string): Promise<void> {
  const message = "today's upzzy oops. upzzyworld.com";
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
    await Share.share({ message: `${message}\n${url}` });
    return;
  }
  const file = await File.downloadFileAsync(url, new File(Paths.cache, `upzzy-${postId}.jpg`), { idempotent: true });
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: message });
}

/** Friends follow each other. Only friends can message. */
export async function areFriends(me: string, other: string): Promise<boolean> {
  const { data, error } = await client().rpc('are_friends', { a: me, b: other });
  if (error) throw error;
  return !!data;
}

/** Your conversations, newest first, then friends you have not talked to yet. */
export async function getChats(): Promise<Chat[]> {
  const { data, error } = await client().rpc('my_chats');
  if (error) throw error;
  return data ?? [];
}

/** The latest messages between you and `other`, newest first. */
export async function getMessages(me: string, other: string, limit = 50): Promise<Message[]> {
  const { data, error } = await client()
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(to: string, body: string): Promise<Message> {
  const text = normalizeMessage(body);
  if (!text) throw new Error('empty');
  const { data, error } = await client().rpc('send_message', { p_to: to, p_body: text });
  if (error) throw error;
  return data as Message;
}

export async function markRead(from: string): Promise<void> {
  const { error } = await client().rpc('mark_read', { p_from: from });
  if (error) throw error;
}

let channels = 0;

/** Calls `onMessage` when someone sends you a message (Supabase Realtime). Returns a stop function. */
export function onNewMessage(me: string, onMessage: (message: Message) => void): () => void {
  if (!supabase) return () => {};
  const db = supabase;
  const channel = db
    .channel(`messages-${me}-${++channels}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${me}` }, (payload) =>
      onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    db.removeChannel(channel);
  };
}

/** Likes are +1 point for the photo's owner once the photo is checked. You cannot like your own. */
export async function setLiked(postId: string, liked: boolean, me: string): Promise<void> {
  const db = client();
  const { error } = liked
    ? await db.from('post_likes').insert({ post_id: postId })
    : await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', me);
  if (error && error.code !== '23505') throw error;
}

/** Staff (moderators and admins) check photos for an UPZZY piece. */
export async function isStaff(): Promise<boolean> {
  const { data, error } = await client().rpc('is_staff');
  if (error) throw error;
  return !!data;
}

export type PendingPost = { id: string; user_id: string; image_path: string; caption: string | null; points: number; created_at: string };

/** Photos waiting for the UPZZY check, oldest first. */
export async function getPendingPosts(): Promise<PendingPost[]> {
  const { data, error } = await client()
    .from('posts')
    .select('id, user_id, image_path, caption, points, created_at')
    .eq('review', 'pending')
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

/** Approve (an UPZZY piece shows) or turn down (no points). The server checks you are staff and logs it. */
export async function reviewPost(postId: string, hasUpzzy: boolean): Promise<void> {
  const { error } = await client().rpc('review_post', { p_post_id: postId, p_has_upzzy: hasUpzzy });
  if (error) throw error;
}

export type ReportedPost = {
  post_id: string;
  user_id: string;
  username: string | null;
  image_path: string;
  caption: string | null;
  status: 'visible' | 'hidden' | 'removed';
  reports: number;
  reasons: string[];
  first_report_at: string;
};

/** Staff: reported photos nobody has looked at yet, oldest first. */
export async function getReportQueue(): Promise<ReportedPost[]> {
  const { data, error } = await client().rpc('report_queue');
  if (error) throw error;
  return (data as ReportedPost[] | null) ?? [];
}

/** Staff: keep a reported photo up, or take it down. The server logs it. */
export async function moderatePost(postId: string, keep: boolean): Promise<void> {
  const { error } = await client().rpc('moderate_post', { p_post_id: postId, p_status: keep ? 'visible' : 'removed' });
  if (error) throw error;
}

/** Staff: ban the person. All their photos come down and no code lets them back in. */
export async function banUser(userId: string, reason: string): Promise<void> {
  const { error } = await client().rpc('ban_user', { p_user_id: userId, p_reason: reason });
  if (error) throw error;
}

/** Only people who bought a piece get in: members (code redeemed) and staff. */
export async function hasAccess(): Promise<boolean> {
  const { data, error } = await client().rpc('has_access');
  if (error) throw error;
  return !!data;
}

export type RedeemResult = 'ok' | 'used' | 'unknown' | 'wait' | 'banned';

/** Unlocks the account with the one-time code from the package. The server checks and spends it. */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const { data, error } = await client().rpc('redeem_code', { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}
