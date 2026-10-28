import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { fonts, radius, space, useTheme } from '@/theme';

/**
 * Shown on home when staff found no UPZZY piece in today's photo. The extra
 * Zs are the mistake, so they get Oops Orange.
 */
export function MistakeNotice() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]} accessibilityRole="alert">
      <Text style={[styles.word, { color: theme.text }]} accessibilityLabel="upzzzz">
        UPZZ<Text style={[styles.word, { color: theme.oops }]}>ZZ</Text>
      </Text>
      <Text variant="bodyStrong">you made a mistake.</Text>
      <Text color="textMuted">no upzzy in your photo, so we deleted it. try again tomorrow.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  word: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: 1.2 },
});
