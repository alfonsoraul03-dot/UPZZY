import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Field, Screen, Text } from '@/components/ui';
import { setAccess } from '@/hooks/useAccess';
import { useSession } from '@/hooks/useSession';
import { friendlyError, redeemCode, signOut, type RedeemResult } from '@/lib/social';
import { space } from '@/theme';

const PROBLEMS: Record<Exclude<RedeemResult, 'ok'>, string> = {
  unknown: "that code doesn't exist. check it again.",
  used: 'that code was already used.',
  wait: 'too many tries. wait an hour.',
  banned: 'this account was closed for breaking the rules.',
};

/** The door: upzzy is for people who bought a piece. The code comes in the package. */
export default function UnlockScreen() {
  const { userId, ready } = useSession();
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

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark />
        </View>
      }>
      <View style={styles.gap}>
        <Text variant="heading">upzzy is for people who wear it.</Text>
        <Text color="textMuted">every piece comes with a one-time code in the package. type it here to get in.</Text>
      </View>
      {!ready || !userId ? null : (
        <View style={styles.gap}>
          <Field
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="UPZ-XXXXX-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            onSubmitEditing={() => enough && unlock()}
            accessibilityLabel="code"
          />
          <Button label={busy ? 'checking…' : 'unlock'} onPress={unlock} disabled={busy || !enough} />
          {error ? <Text color="textMuted">{error}</Text> : null}
          <Button label="wrong account? sign out" variant="outline" onPress={() => signOut()} disabled={busy} />
        </View>
      )}
      <View style={styles.gap}>
        <Text color="textMuted">no piece yet?</Text>
        <Button label="shop drop 001" variant="outline" onPress={() => router.push('/drop')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.md },
});
