import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/Wordmark';
import { layout, space, type as typeScale, useTheme } from '@/theme';
import { enter } from '@/theme/motion';

import { Text } from './Text';

/**
 * The frame of the steps before the app: the wordmark on top, the question
 * and its explanation grouped under it, and the actions at the bottom where
 * the thumb is. On short phones and with the keyboard up it scrolls instead.
 */
export function Onboarding({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Wordmark size={22} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={enter.rise} style={styles.body}>
          {children}
        </Animated.View>
        {footer ? (
          <Animated.View entering={enter.fade.delay(120)} style={styles.footer}>
            {footer}
          </Animated.View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The one big line of a step. Steps down a size on narrow phones so it wraps well. */
export function Hero({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  return (
    <Text accessibilityRole="header" style={[typeScale.hero, narrow && styles.heroNarrow]}>
      {children}
    </Text>
  );
}

/** A supporting paragraph: readable, and clearly second to the headline. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="lead" color="textMuted" style={styles.lead}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter + space.xs,
  },
  body: { paddingTop: space.xxxl, gap: space.lg },
  footer: { marginTop: 'auto', paddingTop: space.xxl, gap: space.md },
  heroNarrow: { fontSize: 31, lineHeight: 36 },
  // Keeps lines to a comfortable reading length on wide phones.
  lead: { maxWidth: 520 },
});
