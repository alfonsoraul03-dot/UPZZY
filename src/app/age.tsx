import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Field, Screen, Text } from '@/components/ui';
import { setAccess } from '@/hooks/useAccess';
import { refreshConsents, useConsents } from '@/hooks/useConsents';
import { useSession } from '@/hooks/useSession';
import { CONTACT_EMAIL } from '@/legal/content';
import { confirmAge, friendlyError, hasAccess, signOut } from '@/lib/social';
import { ADULT_AGE, ageOn, birthDate } from '@/social/rules';
import { space } from '@/theme';

/** Right after signing in: upzzy is 18+. Under 18 needs a parent or guardian's consent by email. */
export default function AgeScreen() {
  const { userId, ready } = useSession();
  const consents = useConsents(userId);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minor, setMinor] = useState(false);

  if (ready && !userId) return <Redirect href="/sign-in" />;
  if (consents?.adult) return <Redirect href={consents.social_answered ? '/' : '/consent'} />;

  const header = (
    <View style={styles.header}>
      <Wordmark />
    </View>
  );

  if (minor || consents?.under_18) {
    return (
      <Screen header={header}>
        <View style={styles.gap}>
          <Text variant="heading">upzzy is {ADULT_AGE}+.</Text>
          <Text color="textMuted">
            if you&apos;re under {ADULT_AGE}, a parent or guardian can email us at {CONTACT_EMAIL} to give their consent. we&apos;ll let you
            in once we have it.
          </Text>
        </View>
        <Button
          label="email upzzy"
          onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('upzzy: consent for under 18')}`)}
        />
        <Button label="sign out" variant="outline" onPress={() => signOut()} />
      </Screen>
    );
  }

  const birth = birthDate(day, month, year, new Date());

  const send = async () => {
    if (!birth || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmAge(birth);
      if (result === 'invalid') {
        setError("that date doesn't look right.");
      } else if (result === 'minor') {
        setMinor(true);
      } else {
        // Members who already had a code get in now.
        setAccess(userId, await hasAccess());
        const next = await refreshConsents(userId);
        router.replace(next.social_answered ? '/' : '/consent');
        return;
      }
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  return (
    <Screen header={header} keyboardShouldPersistTaps="handled">
      <View style={styles.gap}>
        <Text variant="heading">how old are you?</Text>
        <Text color="textMuted">upzzy is for people {ADULT_AGE} and over. we only keep whether you are, not your birthday.</Text>
      </View>
      <View style={styles.row}>
        <Field value={day} onChangeText={setDay} placeholder="dd" keyboardType="number-pad" maxLength={2} accessibilityLabel="day" style={styles.small} />
        <Field value={month} onChangeText={setMonth} placeholder="mm" keyboardType="number-pad" maxLength={2} accessibilityLabel="month" style={styles.small} />
        <Field value={year} onChangeText={setYear} placeholder="yyyy" keyboardType="number-pad" maxLength={4} accessibilityLabel="year" style={styles.big} />
      </View>
      {birth && ageOn(birth, new Date()) >= ADULT_AGE ? null : year.length === 4 && birth ? (
        <Text color="textMuted">under {ADULT_AGE}? you&apos;ll need a parent or guardian&apos;s ok.</Text>
      ) : null}
      <Button label={busy ? 'checking…' : 'continue'} onPress={send} disabled={busy || !birth} />
      {error ? <Text color="textMuted">{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  small: { flex: 1, textAlign: 'center' },
  big: { flex: 1.6, textAlign: 'center' },
});
