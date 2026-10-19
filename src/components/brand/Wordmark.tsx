import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

/**
 * UPZZY with the second Z slipped 8° in Oops Orange. Long-press it: the Z
 * slips a little further. A hidden oops.
 */
export function Wordmark({ size = 24 }: { size?: number }) {
  const theme = useTheme();
  const [slipped, setSlipped] = useState(false);
  const letter = { fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.15, color: theme.text, letterSpacing: size * 0.04 };

  return (
    <Pressable
      accessibilityRole="header"
      accessibilityLabel="UPZZY"
      delayLongPress={600}
      onLongPress={() => {
        haptic('oops');
        setSlipped((s) => !s);
      }}>
      <View style={styles.row}>
        <Text style={letter}>UPZ</Text>
        <Text
          style={[
            letter,
            {
              color: theme.oops,
              transform: [{ rotate: slipped ? '24deg' : '8deg' }, { translateY: size * (slipped ? 0.22 : 0.08) }],
            },
          ]}>
          Z
        </Text>
        <Text style={letter}>Y</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
