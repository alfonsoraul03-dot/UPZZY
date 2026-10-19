import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Field, Sheet, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import { friendlyError, getTodayChallenge, myPost, submitPhoto, type Challenge } from '@/lib/social';
import { CAPTION_MAX } from '@/social/rules';
import { radius, space, useTheme } from '@/theme';

type Step = 'intro' | 'denied' | 'preview' | 'posting' | 'done';

/**
 * Today's challenge: camera only, never the gallery. Preview, retake or post.
 * The server checks the challenge is still open and allows one post a day.
 */
export default function CaptureScreen() {
  const theme = useTheme();
  const { userId, ready } = useSession();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      router.replace('/account');
      return;
    }
    (async () => {
      try {
        const today = await getTodayChallenge();
        setChallenge(today);
        if (today) setAlready(!!(await myPost(today.id, userId)));
      } catch (e) {
        setLoadError(friendlyError(e));
      }
    })();
  }, [ready, userId]);

  const shoot = async () => {
    haptic('tap');
    setError(null);
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
      <Button label="take photo" onPress={shoot} style={styles.cta} />
      <Text variant="caption" color="textMuted">
        camera only. no old photos. one a day.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: space.lg },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
