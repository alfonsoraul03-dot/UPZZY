import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Field, Sheet, Text } from '@/components/ui';
import { refreshConsents, useConsents } from '@/hooks/useConsents';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import { acceptContentRules, friendlyError, getToday, myPost, submitPhoto, type Challenge } from '@/lib/social';
import { CAPTION_MAX, minutesBetween, pointsFor } from '@/social/rules';
import { radius, space, useTheme } from '@/theme';

type Step = 'intro' | 'denied' | 'preview' | 'posting' | 'done';

const PHOTO_RULES = [
  'fit for all ages.',
  'nothing inappropriate: no nudity, nothing sexual, no violence, drugs or hate.',
  'only people who are ok being in it.',
];

/**
 * Today's challenge: camera only, never the gallery. Preview, retake or post.
 * The server checks the challenge is still open and allows one post a day.
 */
export default function CaptureScreen() {
  const theme = useTheme();
  const { userId, ready } = useSession();
  const consents = useConsents(userId);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace('/account');
      return;
    }
    (async () => {
      try {
        const today = await getToday();
        if (!today?.is_open) {
          setClosed(true);
          return;
        }
        setChallenge(today);
        setAlready(!!(await myPost(today.id, userId)));
      } catch (e) {
        setLoadError(friendlyError(e));
      }
    })();
  }, [ready, userId]);

  // Keep the "worth N points" line honest while the person is deciding.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const shoot = async () => {
    haptic('tap');
    setError(null);
    // The first time, taking a photo means accepting the photo rules. The server checks it on posting.
    if (userId && consents && !consents.content_rules) {
      try {
        await acceptContentRules();
        await refreshConsents(userId);
      } catch (e) {
        setError(friendlyError(e));
        return;
      }
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStep('denied');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
    if (result.canceled || !result.assets[0]) return;
    setUri(result.assets[0].uri);
    setStep('preview');
  };

  const post = async () => {
    if (!challenge || !uri || !userId) return;
    setStep('posting');
    setError(null);
    try {
      await submitPhoto(challenge.id, userId, uri, caption);
      haptic('found');
      setStep('done');
    } catch (e) {
      haptic('oops');
      setError(friendlyError(e));
      setStep('preview');
    }
  };

  if (loadError) {
    return (
      <Sheet title="today's challenge">
        <Text variant="title">{loadError}</Text>
        <Button label="close" variant="outline" onPress={() => router.back()} />
      </Sheet>
    );
  }

  if (closed) {
    return (
      <Sheet title="today's challenge">
        <Text variant="title">not out yet.</Text>
        <Text color="textMuted">it drops at a random time. be quick when it does.</Text>
        <Button label="close" variant="outline" onPress={() => router.back()} />
      </Sheet>
    );
  }

  if (!challenge) {
    return (
      <Sheet title="today's challenge">
        <Text color="textMuted">loading…</Text>
      </Sheet>
    );
  }

  if (step === 'done' || already) {
    return (
      <Sheet title="today's challenge">
        <Text variant="title">{step === 'done' ? 'posted. no undo.' : 'you already posted today.'}</Text>
        <Text color="textMuted">new challenge tomorrow.</Text>
        <Button label="see the feed" onPress={() => router.back()} style={styles.cta} />
      </Sheet>
    );
  }

  if (step === 'denied') {
    return (
      <Sheet title="today's challenge">
        <Text variant="title">the camera is off.</Text>
        <Text color="textMuted">challenge photos are taken in the app, right now. turn the camera on for upzzy in settings.</Text>
        <Button label="open settings" onPress={() => Linking.openSettings()} style={styles.cta} />
        <Button label="try again" variant="outline" onPress={shoot} />
      </Sheet>
    );
  }

  if ((step === 'preview' || step === 'posting') && uri) {
    const posting = step === 'posting';
    return (
      <Sheet title="today's challenge">
        <Image source={{ uri }} style={[styles.preview, { backgroundColor: theme.surface }]} contentFit="cover" accessibilityLabel="your photo" />
        <Field
          value={caption}
          onChangeText={setCaption}
          placeholder="say something. or don't."
          maxLength={CAPTION_MAX}
          editable={!posting}
          accessibilityLabel="caption"
        />
        <Text variant="caption" color="textMuted">
          fit for all ages. nothing inappropriate.
        </Text>
        <View style={styles.row}>
          <Button label="retake" variant="outline" onPress={shoot} disabled={posting} style={styles.half} />
          <Button label={posting ? 'posting…' : 'post'} onPress={post} disabled={posting} style={styles.half} />
        </View>
        {error ? <Text color="textMuted">{error}</Text> : null}
      </Sheet>
    );
  }

  return (
    <Sheet title="today's challenge">
      <Text variant="title">{challenge.title}</Text>
      {challenge.description ? <Text color="textMuted">{challenge.description}</Text> : null}
      {challenge.reward ? <Text>prize: {challenge.reward}</Text> : null}
      <Text color="textMuted">an upzzy piece has to be in the photo. we check every one. no piece, no points.</Text>
      <View style={[styles.rules, { backgroundColor: theme.surface }]} accessibilityRole="summary">
        <Text variant="bodyStrong">photo rules</Text>
        {PHOTO_RULES.map((rule) => (
          <Text key={rule} color="textMuted">
            · {rule}
          </Text>
        ))}
        <Text variant="caption" color="textMuted">
          break them and the photo comes down, and the account can be closed.
        </Text>
      </View>
      <Button label={consents && !consents.content_rules ? 'got it · take photo' : 'take photo'} onPress={shoot} style={styles.cta} />
      {error ? <Text color="textMuted">{error}</Text> : null}
      <Text variant="caption" color="textMuted">
        worth {pointsFor(minutesBetween(challenge.opens_at, new Date()), challenge.max_points)} points right now. camera only. one a day.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: space.lg },
  rules: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
