import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { completeAuthLink } from './social';
import { supabase } from './supabase';

/**
 * Sign in with Apple or Google through Supabase Auth. On iPhone Apple uses
 * the native sheet; everything else opens the provider's page in a secure
 * browser and comes back to upzzy://auth.
 */

export type Provider = 'apple' | 'google';

/** The native Apple sheet exists on iPhone (and needs a development build). */
export async function nativeAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Resolves true when signed in, false when the person closed the sheet. */
export async function signInWith(provider: Provider): Promise<boolean> {
  if (!supabase) throw new Error('not connected');
  if (provider === 'apple' && (await nativeAppleAvailable())) return nativeApple();
  return browser(provider);
}

async function nativeApple(): Promise<boolean> {
  // Apple signs a hash of the nonce; Supabase checks it against the raw one.
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('apple did not send a sign-in token');
  const { error } = await supabase!.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: raw });
  if (error) throw error;
  return true;
}

async function browser(provider: Provider): Promise<boolean> {
  if (Platform.OS === 'web') {
    // The page leaves for the provider and comes back signed in (see useAuthLinks).
    const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) throw error;
    return false;
  }
  const redirectTo = Linking.createURL('auth');
  const { data, error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  return completeAuthLink(result.url);
}
