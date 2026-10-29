import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Hero, Lead, Onboarding, Text } from '@/components/ui';
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
    <Onboarding
      footer={
        <>
          {error ? (
            <Text variant="caption" color="textMuted">
              {error}
            </Text>
          ) : null}
          <Button label="yes, you can share them" onPress={() => answer(true)} disabled={busy} />
          <Button label="no, keep them in the app" variant="outline" onPress={() => answer(false)} disabled={busy} />
        </>
      }>
      <Text variant="label" color="textMuted">
        your photos
      </Text>
      <Hero>can we share your photos?</Hero>
      <View style={styles.paragraphs}>
        <Lead>
          sometimes we post challenge photos on upzzy&apos;s social media, like instagram and tiktok. only photos our staff approved, and
          only if you say yes.
        </Lead>
        <Lead>it&apos;s up to you. it doesn&apos;t change anything in the app, and you can change your mind any time in settings.</Lead>
      </View>
    </Onboarding>
  );
}

const styles = StyleSheet.create({
  paragraphs: { gap: space.md },
});
