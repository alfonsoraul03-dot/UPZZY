import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { SignInOptions } from '@/components/auth/SignInOptions';
import { Wordmark } from '@/components/brand/Wordmark';
import { Screen, Text } from '@/components/ui';
import { useAuthLinks } from '@/hooks/useAuthLinks';
import { useSession } from '@/hooks/useSession';
import { space } from '@/theme';
import { enter, timing } from '@/theme/motion';

/** The first screen: big UPZZY, then Apple, Google or email. The code from the package comes after. */
export default function SignInScreen() {
  const { userId, ready } = useSession();
  const linkProblem = useAuthLinks();

  // Signed in: the tabs send people without a code on to /unlock.
  if (ready && userId) return <Redirect href="/" />;

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <Reveal>
        <View style={styles.brand}>
          <Wordmark size={72} />
          <Text color="textMuted">happened by mistake. stayed on purpose.</Text>
        </View>
      </Reveal>
      {ready ? (
        <Animated.View entering={enter.rise.delay(160)} style={styles.gap}>
          <SignInOptions linkProblem={linkProblem} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

/** The wordmark arrives: a fade and a slight settle. Quick, and it never blocks a tap. */
function Reveal({ children }: { children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, timing(480)));
  }, [shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 0.96 + shown.value * 0.04 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: space.md, paddingTop: space.xxl, paddingBottom: space.xl },
  gap: { gap: space.md },
});
