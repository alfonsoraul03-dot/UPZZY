import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Screen, Text } from '@/components/ui';
import { refreshConsents, useConsents } from '@/hooks/useConsents';
import { useSession } from '@/hooks/useSession';
import { friendlyError, setSocialConsent } from '@/lib/social';
import { space } from '@/theme';

/** Asked once: may UPZZY share your challenge photos on its social media? Optional, and you can change it later. */
export default function ConsentScreen() {
  const { userId, ready } = useSession();
  const consents = useConsents(userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && !userId) return <Redirect href="/sign-in" />;
  if (consents && !consents.adult) return <Redirect href="/age" />;

  const answer = async (ok: boolean) => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await setSocialConsent(ok);
      await refreshConsents(userId);
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark />
        </View>
      }>
      <View style={styles.gap}>
        <Text variant="heading">can we share your photos?</Text>
        <Text color="textMuted">
          sometimes we post challenge photos on upzzy&apos;s social media, like instagram and tiktok. only photos our staff approved, and
          only if you say yes.
        </Text>
        <Text color="textMuted">it&apos;s up to you. it doesn&apos;t change anything in the app, and you can change your mind any time in settings.</Text>
      </View>
      <Button label="yes, you can share them" onPress={() => answer(true)} disabled={busy} />
      <Button label="no, keep them in the app" variant="outline" onPress={() => answer(false)} disabled={busy} />
      {error ? <Text color="textMuted">{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.sm },
});
