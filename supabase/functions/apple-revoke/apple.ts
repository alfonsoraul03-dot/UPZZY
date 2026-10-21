/**
 * Apple asks apps that use Sign in with Apple to revoke the user's Apple
 * token when they delete their account. The app sends a fresh authorization
 * code from the Apple sheet; this turns it into a token and revokes it.
 * Plain Web Crypto and fetch, so it runs on Supabase Edge (Deno) and in Node tests.
 */

export type AppleKeys = { teamId: string; keyId: string; clientId: string; privateKey: string };

const APPLE = 'https://appleid.apple.com';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s: string) => b64url(new TextEncoder().encode(s));

/** The short-lived "client secret" Apple wants: a JWT signed with the .p8 key (ES256). */
export async function clientSecret(keys: AppleKeys, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const pem = keys.privateKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = text(JSON.stringify({ alg: 'ES256', kid: keys.keyId }));
  const body = text(JSON.stringify({ iss: keys.teamId, iat: now, exp: now + 300, aud: APPLE, sub: keys.clientId }));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

/** Exchanges the code for a token and revokes it. Throws with Apple's answer if either step fails. */
export async function revokeWithCode(code: string, keys: AppleKeys, fetchImpl: typeof fetch = fetch): Promise<void> {
  const secret = await clientSecret(keys);
  const form = (fields: Record<string, string>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: keys.clientId, client_secret: secret, ...fields }).toString(),
  });
  const tokenRes = await fetchImpl(`${APPLE}/auth/token`, form({ grant_type: 'authorization_code', code }));
  const token = (await tokenRes.json()) as { refresh_token?: string; access_token?: string; error?: string };
  if (!tokenRes.ok || !(token.refresh_token ?? token.access_token)) throw new Error(`apple token: ${token.error ?? tokenRes.status}`);
  const hint = token.refresh_token ? 'refresh_token' : 'access_token';
  const revokeRes = await fetchImpl(`${APPLE}/auth/revoke`, form({ token: (token.refresh_token ?? token.access_token)!, token_type_hint: hint }));
  if (!revokeRes.ok) throw new Error(`apple revoke: ${revokeRes.status}`);
}
