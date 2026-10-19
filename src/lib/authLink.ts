/**
 * Reads the sign-in link from the email. After Supabase checks the link it
 * opens the app with either tokens in the `#fragment` (implicit flow) or a
 * `?code=` (PKCE flow), or an error.
 */
export type AuthLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | null;

export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url) return null;
  const params = new URLSearchParams();
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  if (query >= 0) new URLSearchParams(url.slice(query + 1, hash > query ? hash : undefined)).forEach((v, k) => params.set(k, v));
  if (hash >= 0) new URLSearchParams(url.slice(hash + 1)).forEach((v, k) => params.set(k, v));

  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return null;
}
