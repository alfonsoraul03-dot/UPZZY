import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';

import { AppleLogo, GoogleLogo } from '@/components/auth/BrandLogos';
import { Button, Field, Text } from '@/components/ui';
import { nativeAppleAvailable, signInWith, type Provider } from '@/lib/oauth';
import { friendlyError, sendLoginCode, signInWithoutEmail, verifyLoginCode } from '@/lib/social';
import { isEmail, isLoginCode } from '@/social/rules';

/** Apple, Google, or an emailed code. Used by the sign-in screen and the account sheet. */
export function SignInOptions({ linkProblem }: { linkProblem: string | null }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'pick' | 'email' | 'code'>('pick');
  const [appleSheet, setAppleSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <>
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
            <Button label="continue with apple" icon={(color) => <AppleLogo color={color} />} onPress={() => withProvider('apple')} disabled={busy} />
          )}
          <Button label="continue with google" variant="outline" icon={() => <GoogleLogo />} onPress={() => withProvider('google')} disabled={busy} />
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
    </>
  );
}

export function LegalLink({ doc }: { doc: 'terms' | 'privacy' }) {
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
  apple: { height: 54, width: '100%' },
  link: { textDecorationLine: 'underline' },
});
