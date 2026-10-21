// Supabase Edge Function: revoke a user's Sign in with Apple token before
// their account is deleted. Secrets (set with `supabase secrets set`):
// APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID (com.upzzy.app), APPLE_PRIVATE_KEY (the .p8).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { revokeWithCode } from './apple.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  // Only the signed-in person, for their own Apple account.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return json(401, { error: 'sign in first' });
  if (!data.user.identities?.some((i) => i.provider === 'apple')) return json(400, { error: 'not an apple account' });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (typeof code !== 'string' || code.length < 10 || code.length > 1000) return json(400, { error: 'missing code' });

  try {
    await revokeWithCode(code, {
      teamId: Deno.env.get('APPLE_TEAM_ID')!,
      keyId: Deno.env.get('APPLE_KEY_ID')!,
      clientId: Deno.env.get('APPLE_CLIENT_ID') ?? 'com.upzzy.app',
      privateKey: Deno.env.get('APPLE_PRIVATE_KEY')!,
    });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
  return json(200, { revoked: true });
});
