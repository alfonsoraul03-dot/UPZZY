import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field, Hero, Lead, Onboarding, Text } from '@/components/ui';
import { setAccess } from '@/hooks/useAccess';
import { useConsents } from '@/hooks/useConsents';
import { useSession } from '@/hooks/useSession';
import { friendlyError, redeemCode, signOut, type RedeemResult } from '@/lib/social';
import { fonts, space, useTheme } from '@/theme';

const PROBLEMS: Record<Exclude<RedeemResult, 'ok'>, string> = {
  unknown: "that code doesn't exist. check it again.",
  used: 'that code was already used.',
  wait: 'too many tries. wait an hour.',
  banned: 'this account was closed for breaking the rules.',
};

/** The door: upzzy is for people who bought a piece. The code comes in the package. */
export default function UnlockScreen() {
  const theme = useTheme();
  const { userId, ready } = useSession();
  const consents = useConsents(userId);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await redeemCode(code);
      if (result === 'ok') {
        setAccess(userId, true);
        router.replace('/welcome');
        return;
      }
      setError(PROBLEMS[result]);
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  const enough = code.replace(/[^a-z0-9]/gi, '').length >= 10;

  if (ready && !userId) return <Redirect href="/sign-in" />;
  if (consents && !consents.adult) return <Redirect href="/age" />;

  return (
    <Onboarding
      footer={
        <>
          {!ready || !userId ? null : (
            <>
              {error ? (
                <Text variant="caption" color="textMuted">
                  {error}
                </Text>
              ) : null}
              <Button label={busy ? 'checking…' : 'unlock'} onPress={unlock} disabled={busy || !enough} />
            </>
          )}
          <View style={[styles.other, { borderTopColor: theme.border }]}>
            <Text variant="caption" color="textMuted">
              no piece yet?
            </Text>
            <Button label="shop drop 001" variant="outline" onPress={() => router.push('/drop')} />
            {!ready || !userId ? null : (
              <Button label="wrong account? sign out" variant="outline" onPress={() => signOut()} disabled={busy} />
            )}
          </View>
        </>
      }>
      <Text variant="label" color="textMuted">
        members only
      </Text>
      <Hero>upzzy is for people who wear it.</Hero>
      <Lead>every piece comes with a one-time code in the package. type it here to get in.</Lead>
      {!ready || !userId ? null : (
        <Field
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="UPZ-XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          onSubmitEditing={() => enough && unlock()}
          accessibilityLabel="code"
          style={styles.code}
        />
      )}
    </Onboarding>
  );
}

const styles = StyleSheet.create({
  code: { marginTop: space.sm, fontFamily: fonts.mono, fontSize: 18, letterSpacing: 1 },
  other: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md, paddingTop: space.lg, gap: space.md },
});
