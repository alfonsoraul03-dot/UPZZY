import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { normalizeCaption, photoPath, type FeedPost, type FeedScope } from '@/social/rules';

import { parseAuthLink } from './authLink';
import { supabase } from './supabase';

/**
 * Everything the photo challenge asks of the backend. Every rule (one post a
 * day, own folder, counts, visibility) is enforced again by the database.
 */

export type Challenge = {
  id: string;
  day: string;
  title: string;
  description: string | null;
  reward: string | null;
};

export type Profile = { id: string; username: string };

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
  if (e?.message?.includes('This challenge is closed')) return 'this challenge closed. new one is up.';
  if (e?.message === 'not connected') return 'not connected yet.';
  if (e?.message?.toLowerCase().includes('network')) return 'no connection. try again.';
  return "didn't go through. try again.";
}

export async function getTodayChallenge(): Promise<Challenge | null> {
  const { data, error } = await client().rpc('today_challenge');
  if (error) throw error;
  const row = data as Challenge | null;
  return row?.id ? row : null;
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

export async function setLiked(postId: string, liked: boolean): Promise<void> {
  const db = client();
  const { error } = liked
    ? await db.from('post_likes').insert({ post_id: postId })
    : await db.from('post_likes').delete().eq('post_id', postId);
  if (error && error.code !== '23505') throw error;
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

export async function signOut(): Promise<void> {
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
