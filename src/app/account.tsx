import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field, Sheet, Text } from '@/components/ui';
import { useAuthLinks } from '@/hooks/useAuthLinks';
import { useSession } from '@/hooks/useSession';
import { deleteAccount, friendlyError, getMyProfile, sendLoginCode, setUsername, signInWithoutEmail, signOut, verifyLoginCode } from '@/lib/social';
import { isEmail, isLoginCode, isPlaceholderUsername } from '@/social/rules';
import { normalizeUsername, validateUsername } from '@/lib/validation';
import { space } from '@/theme';

/** Sign in with an emailed code, pick a name, sign out or delete the account. */
export default function AccountScreen() {
  const { userId, ready, configured } = useSession();
  const linkProblem = useAuthLinks();

  if (!configured) {
    return (
      <Sheet title="you">
        <Text variant="title">not connected yet.</Text>
        <Text color="textMuted">add the supabase keys to .env. the steps are in the readme.</Text>
      </Sheet>
    );
  }
  if (!ready) return <Sheet title="you">{null}</Sheet>;
  return userId ? <SignedIn userId={userId} /> : <SignIn linkProblem={linkProblem} />;
}

function SignIn({ linkProblem }: { linkProblem: string | null }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendLoginCode(email);
      setStep('code');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // Only in development builds: try the app without waiting for an email.
  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithoutEmail();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyLoginCode(email, code);
    } catch {
      setError('wrong or old code. try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="sign in">
      {step === 'email' ? (
        <>
          <Text variant="title">your email.</Text>
          <Text color="textMuted">we send you a code. no password.</Text>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={() => isEmail(email) && send()}
            accessibilityLabel="email"
          />
          <Button label={busy ? 'sending…' : 'send code'} onPress={send} disabled={busy || !isEmail(email)} />
          {__DEV__ ? <Button label="skip email (dev only)" variant="outline" onPress={skip} disabled={busy} /> : null}
        </>
      ) : (
        <>
          <Text variant="title">check your email.</Text>
          <Text color="textMuted">open it on this phone and tap the link. if it has a code, type it here.</Text>
          <Field
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            onSubmitEditing={() => isLoginCode(code) && verify()}
            accessibilityLabel="code"
          />
          <Button label={busy ? 'checking…' : 'sign in'} onPress={verify} disabled={busy || !isLoginCode(code)} />
          <Button
            label="use another email"
            variant="outline"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          />
        </>
      )}
      {error || linkProblem ? <Text color="textMuted">{error ?? linkProblem}</Text> : null}
    </Sheet>
  );
}

function SignedIn({ userId }: { userId: string }) {
  const { session } = useSession();
  const [username, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await getMyProfile(userId);
      setName(profile?.username ?? null);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const problem = validateUsername(draft);
    if (problem) return setError(problem.toLowerCase());
    setBusy(true);
    setError(null);
    try {
      await setUsername(userId, normalizeUsername(draft));
      setName(normalizeUsername(draft));
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError((e as { code?: string }).code === '23505' ? 'taken. try another.' : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccount(userId);
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  if (!loaded) return <Sheet title="you">{null}</Sheet>;

  if (isPlaceholderUsername(username)) {
    return (
      <Sheet title="you">
        <Text variant="title">pick a name.</Text>
        <Text color="textMuted">it shows on your photos.</Text>
        <Field
          value={draft}
          onChangeText={setDraft}
          placeholder="name"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
          onSubmitEditing={save}
          accessibilityLabel="name"
        />
        <Button label={busy ? 'saving…' : 'save'} onPress={save} disabled={busy || draft.trim().length < 3} />
        {error ? <Text color="textMuted">{error}</Text> : null}
      </Sheet>
    );
  }

  return (
    <Sheet title="you">
      <Text variant="title">@{username}</Text>
      {session?.user.is_anonymous ? (
        <Text color="textMuted">test account with no email. if you sign out it is gone.</Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="sign out" variant="outline" onPress={() => signOut()} disabled={busy} />
        {confirmDelete ? (
          <>
            <Text color="textMuted">delete your account and every photo? no undo.</Text>
            <Button label={busy ? 'deleting…' : 'delete for good'} onPress={remove} disabled={busy} />
            <Button label="keep it" variant="outline" onPress={() => setConfirmDelete(false)} disabled={busy} />
          </>
        ) : (
          <Button label="delete account" variant="outline" onPress={() => setConfirmDelete(true)} />
        )}
      </View>
      {error ? <Text color="textMuted">{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.md, marginTop: space.xl },
});
