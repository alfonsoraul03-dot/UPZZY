import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';

import { Button, Field, Sheet, Text } from '@/components/ui';
import { useAuthLinks } from '@/hooks/useAuthLinks';
import { useSession } from '@/hooks/useSession';
import { nativeAppleAvailable, revokeApple, signInWith, type Provider } from '@/lib/oauth';
import { deleteAccount, friendlyError, getMyProfile, isStaff, sendLoginCode, setUsername, signInWithoutEmail, signOut, verifyLoginCode } from '@/lib/social';
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
  const [step, setStep] = useState<'pick' | 'email' | 'code'>('pick');
  const [appleSheet, setAppleSheet] = useState(false);

  useEffect(() => {
    nativeAppleAvailable().then(setAppleSheet);
  }, []);

  const withProvider = async (provider: Provider) => {
    setBusy(true);
    setError(null);
    try {
      await signInWith(provider);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
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
      {step === 'pick' ? (
        <>
          <Text variant="title">get in.</Text>
          <Text color="textMuted">one tap. no password.</Text>
          {appleSheet ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={999}
              style={styles.apple}
              onPress={() => !busy && withProvider('apple')}
            />
          ) : (
            <Button label="continue with apple" onPress={() => withProvider('apple')} disabled={busy} />
          )}
          <Button label="continue with google" variant="outline" onPress={() => withProvider('google')} disabled={busy} />
          <Button label="use email instead" variant="outline" onPress={() => setStep('email')} disabled={busy} />
          {__DEV__ ? <Button label="skip (dev only)" variant="outline" onPress={skip} disabled={busy} /> : null}
          <Text variant="caption" color="textMuted">
            by going in you agree to the <LegalLink doc="terms" /> and the <LegalLink doc="privacy" /> policy. zero tolerance for nasty stuff.
          </Text>
        </>
      ) : step === 'email' ? (
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
          <Button label="back" variant="outline" onPress={() => setStep('pick')} disabled={busy} />
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
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    Promise.all([getMyProfile(userId), isStaff().catch(() => false)])
      .then(([profile, isStaffMember]) => {
        setName(profile?.username ?? null);
        setStaff(isStaffMember);
        setError(null);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoaded(true));
  }, [userId]);

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
    setError(null);
    try {
      // Accounts made with Apple: confirm with Apple so it forgets upzzy too.
      const apple = await revokeApple().catch((e) => {
        // Deleting your data matters more; Apple access can still be removed in Settings.
        console.warn('apple revoke failed:', e);
        return 'skipped' as const;
      });
      if (apple === 'canceled') {
        setBusy(false);
        return;
      }
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
        {staff ? <Button label="staff: reports and upzzy check" onPress={() => router.push('/review')} /> : null}
        <Button label="sign out" variant="outline" onPress={() => signOut()} disabled={busy} />
        <Text variant="caption" color="textMuted">
          <LegalLink doc="terms" /> · <LegalLink doc="privacy" />
        </Text>
        {confirmDelete ? (
          <>
            <Text color="textMuted">delete your account and every photo? no undo. signed in with apple? confirm with apple next.</Text>
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

function LegalLink({ doc }: { doc: 'terms' | 'privacy' }) {
  return (
    <Text
      variant="caption"
      color="text"
      style={styles.link}
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc } })}>
      {doc}
    </Text>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.md, marginTop: space.xl },
  apple: { height: 54, width: '100%' },
  link: { textDecorationLine: 'underline' },
});
