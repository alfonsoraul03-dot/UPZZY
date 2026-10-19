import { parseAuthLink } from '@/lib/authLink';

describe('parseAuthLink', () => {
  it('reads tokens from the fragment', () => {
    expect(
      parseAuthLink('exp://192.168.1.5:8081/--/account#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup'),
    ).toEqual({ kind: 'tokens', accessToken: 'a.b.c', refreshToken: 'r1' });
  });

  it('reads a PKCE code from the query', () => {
    expect(parseAuthLink('upzzy://account?code=xyz')).toEqual({ kind: 'code', code: 'xyz' });
  });

  it('reports errors, like an expired link', () => {
    expect(parseAuthLink('upzzy://account#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toEqual({
      kind: 'error',
      message: 'Email link is invalid or has expired',
    });
  });

  it('ignores ordinary links', () => {
    expect(parseAuthLink('upzzy://oops')).toBeNull();
    expect(parseAuthLink(null)).toBeNull();
  });
});
