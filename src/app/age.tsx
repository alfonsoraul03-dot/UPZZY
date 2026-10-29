import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Field, Hero, Lead, Onboarding, Text } from '@/components/ui';
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

  if (minor || consents?.under_18) {
    return (
      <Onboarding
        footer={
          <>
            <Button
              label="email upzzy"
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('upzzy: consent for under 18')}`)}
            />
            <Button label="sign out" variant="outline" onPress={() => signOut()} />
          </>
        }>
        <Text variant="label" color="textMuted">
          age check
        </Text>
        <Hero>upzzy is {ADULT_AGE}+.</Hero>
        <Lead>
          if you&apos;re under {ADULT_AGE}, a parent or guardian can email us at <Text variant="lead">{CONTACT_EMAIL}</Text> to give their
          consent. we&apos;ll let you in once we have it.
        </Lead>
      </Onboarding>
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
    <Onboarding footer={<Button label={busy ? 'checking…' : 'continue'} onPress={send} disabled={busy || !birth} />}>
      <Text variant="label" color="textMuted">
        age check
      </Text>
      <Hero>how old are you?</Hero>
      <Lead>upzzy is for people {ADULT_AGE} and over. we only keep whether you are, not your birthday.</Lead>
      <View style={styles.row}>
        <DatePart label="day" value={day} onChange={setDay} placeholder="dd" length={2} />
        <DatePart label="month" value={month} onChange={setMonth} placeholder="mm" length={2} />
        <DatePart label="year" value={year} onChange={setYear} placeholder="yyyy" length={4} wide />
      </View>
      {birth && ageOn(birth, new Date()) >= ADULT_AGE ? null : year.length === 4 && birth ? (
        <Text variant="caption" color="textMuted">
          under {ADULT_AGE}? you&apos;ll need a parent or guardian&apos;s ok.
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" color="textMuted">
          {error}
        </Text>
      ) : null}
    </Onboarding>
  );
}

/** One part of the birth date, with its name above it. */
function DatePart({
  label,
  value,
  onChange,
  placeholder,
  length,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  length: number;
  wide?: boolean;
}) {
  return (
    <View style={[styles.part, wide && styles.partWide]}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Field
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="number-pad"
        maxLength={length}
        accessibilityLabel={label}
        style={styles.dateField}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  part: { flex: 1, minWidth: 0, gap: space.xs },
  partWide: { flex: 1.45 },
  dateField: { width: '100%', textAlign: 'center', fontSize: 19, fontVariant: ['tabular-nums'] },
});
