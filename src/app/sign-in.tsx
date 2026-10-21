import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SignInOptions } from '@/components/auth/SignInOptions';
import { Wordmark } from '@/components/brand/Wordmark';
import { Screen, Text } from '@/components/ui';
import { useAuthLinks } from '@/hooks/useAuthLinks';
import { useSession } from '@/hooks/useSession';
import { space } from '@/theme';

/** The first screen: big UPZZY, then Apple, Google or email. The code from the package comes after. */
export default function SignInScreen() {
  const { userId, ready } = useSession();
  const linkProblem = useAuthLinks();

  // Signed in: the tabs send people without a code on to /unlock.
  if (ready && userId) return <Redirect href="/" />;

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <Wordmark size={72} />
        <Text color="textMuted">happened by mistake. stayed on purpose.</Text>
      </View>
      {ready ? (
        <View style={styles.gap}>
          <SignInOptions linkProblem={linkProblem} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: space.md, paddingTop: space.xxl, paddingBottom: space.xl },
  gap: { gap: space.md },
});
