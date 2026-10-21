// Run with: npm run test:functions
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';

import { clientSecret, revokeWithCode, type AppleKeys } from './apple.ts';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const keys: AppleKeys = {
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  clientId: 'com.upzzy.app',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};
const part = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString());

test('client secret is a valid ES256 JWT for apple', async () => {
  const jwt = await clientSecret(keys, 1_000_000);
  const [h, b, s] = jwt.split('.');
  assert.deepEqual(part(h), { alg: 'ES256', kid: 'KEY1234567' });
  assert.deepEqual(part(b), { iss: 'TEAM123456', iat: 1_000_000, exp: 1_000_300, aud: 'https://appleid.apple.com', sub: 'com.upzzy.app' });
  const ok = verify('sha256', Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  assert.ok(ok, 'signature does not verify');
});

test('exchanges the code, then revokes the refresh token', async () => {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(String(init.body)) });
    const body = url.endsWith('/auth/token') ? { refresh_token: 'r-token', access_token: 'a-token' } : {};
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  await revokeWithCode('the-code-from-apple', keys, fake);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.get('code'), 'the-code-from-apple');
  assert.equal(calls[0].body.get('grant_type'), 'authorization_code');
  assert.equal(calls[1].url, 'https://appleid.apple.com/auth/revoke');
  assert.equal(calls[1].body.get('token'), 'r-token');
  assert.equal(calls[1].body.get('token_type_hint'), 'refresh_token');
  assert.equal(calls[1].body.get('client_id'), 'com.upzzy.app');
});

test('a bad code is an error, and nothing is revoked', async () => {
  let revokes = 0;
  const fake = (async (url: string) => {
    if (url.endsWith('/auth/revoke')) revokes++;
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  }) as typeof fetch;
  await assert.rejects(revokeWithCode('expired-code', keys, fake), /invalid_grant/);
  assert.equal(revokes, 0);
});
