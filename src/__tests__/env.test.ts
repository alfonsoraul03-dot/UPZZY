import { looksLikeServiceRoleKey, readPublicConfig } from '@/lib/env';

function jwt(payload: object) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

describe('readPublicConfig', () => {
  it('accepts a valid project URL and anon key', () => {
    const result = readPublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co/',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }),
    });
    expect(result).toEqual({ ok: true, supabaseUrl: 'https://abcd1234.supabase.co', supabaseAnonKey: expect.any(String) });
  });

  it('accepts publishable keys and local development URLs', () => {
    const result = readPublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc123',
    });
    expect(result.ok).toBe(true);
  });

  it('reports every missing variable', () => {
    const result = readPublicConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toHaveLength(2);
  });

  it('rejects malformed URLs', () => {
    const result = readPublicConfig({ EXPO_PUBLIC_SUPABASE_URL: 'supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x' });
    expect(result.ok).toBe(false);
  });

  it('refuses to ship a service-role key in the app', () => {
    for (const key of [jwt({ role: 'service_role' }), 'sb_secret_abc']) {
      const result = readPublicConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: key });
      expect(result.ok).toBe(false);
    }
  });
});

describe('looksLikeServiceRoleKey', () => {
  it('ignores anon keys and garbage', () => {
    expect(looksLikeServiceRoleKey(jwt({ role: 'anon' }))).toBe(false);
    expect(looksLikeServiceRoleKey('a.b.c')).toBe(false);
    expect(looksLikeServiceRoleKey('not-a-key')).toBe(false);
  });
});
