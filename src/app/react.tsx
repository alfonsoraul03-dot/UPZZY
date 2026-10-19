import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import { friendlyError, reactWithPhoto } from '@/lib/social';
import { space, useTheme } from '@/theme';

type Step = 'intro' | 'denied' | 'preview' | 'sending';

/** React to someone's photo with a quick selfie from the front camera. */
export default function ReactScreen() {
  const theme = useTheme();
  const { post, name } = useLocalSearchParams<{ post: string; name?: string }>();
  const { userId, ready } = useSession();
  const [step, setStep] = useState<Step>('intro');
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !userId) router.replace('/account');
  }, [ready, userId]);

  const shoot = async () => {
    haptic('tap');
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStep('denied');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      quality: 0.5,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setUri(result.assets[0].uri);
    setStep('preview');
  };

  const send = async () => {
    if (!uri || !userId || !post) return;
    setStep('sending');
    try {
      await reactWithPhoto(post, userId, uri);
      haptic('found');
      router.back();
    } catch (e) {
      haptic('oops');
      setError(friendlyError(e));
      setStep('preview');
    }
  };

  if (step === 'denied') {
    return (
      <Sheet title="react">
        <Text variant="title">the camera is off.</Text>
        <Text color="textMuted">reactions are a quick selfie. turn the camera on for upzzy in settings.</Text>
        <Button label="open settings" onPress={() => Linking.openSettings()} />
        <Button label="try again" variant="outline" onPress={shoot} />
      </Sheet>
    );
  }

  if ((step === 'preview' || step === 'sending') && uri) {
    const sending = step === 'sending';
    return (
      <Sheet title="react">
        <Image source={{ uri }} style={[styles.preview, { backgroundColor: theme.surface }]} contentFit="cover" accessibilityLabel="your reaction" />
        <View style={styles.row}>
          <Button label="retake" variant="outline" onPress={shoot} disabled={sending} style={styles.half} />
          <Button label={sending ? 'sending…' : 'send'} onPress={send} disabled={sending} style={styles.half} />
        </View>
        {error ? <Text color="textMuted">{error}</Text> : null}
      </Sheet>
    );
  }

  return (
    <Sheet title="react">
      <Text variant="title">react to {name ?? 'this photo'}.</Text>
      <Text color="textMuted">with your face. a quick selfie, right now.</Text>
      <Button label="take selfie" onPress={shoot} style={styles.cta} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: space.lg },
  preview: { width: 220, height: 220, borderRadius: 110, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
