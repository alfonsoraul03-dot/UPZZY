import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Profile } from '@/components/social/Profile';
import { Button, Screen, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { space } from '@/theme';

/** Your profile: streak, points and your challenge photos. */
export default function YouScreen() {
  const { userId, ready, configured } = useSession();

  const header = (
    <View style={styles.header}>
      <Wordmark />
    </View>
  );

  if (!configured || !ready) {
    return (
      <Screen header={header}>
        <Text color="textMuted">{configured ? 'loading…' : 'not connected yet.'}</Text>
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen header={header}>
        <View style={styles.signedOut}>
          <Text variant="title">your photos, streak and points live here.</Text>
          <Text color="textMuted">sign in to start.</Text>
          <Button label="sign in" onPress={() => router.push('/account')} />
          <Button label="shop drop 001" variant="outline" onPress={() => router.push('/drop')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <Profile
        userId={userId}
        me={userId}
        actions={
          <View style={styles.actions}>
            <Button label="settings" variant="outline" onPress={() => router.push('/account')} style={styles.half} />
            <Button label="shop" variant="outline" onPress={() => router.push('/drop')} style={styles.half} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  signedOut: { gap: space.lg, paddingTop: space.xl },
  actions: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.lg },
});
