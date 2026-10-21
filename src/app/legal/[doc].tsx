import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { PRIVACY, TERMS } from '@/legal/content';
import { space } from '@/theme';

/** The privacy policy or the terms. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = doc === 'terms' ? TERMS : PRIVACY;

  return (
    <Sheet title={page.title}>
      <View style={styles.page}>
        {page.sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text variant="bodyStrong">{s.heading}</Text>
            {s.body.map((line) => (
              <Text key={line} color="textMuted">
                {line}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xl },
  section: { gap: space.xs },
});
