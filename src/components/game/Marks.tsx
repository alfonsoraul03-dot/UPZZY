import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * A neat row of small squares. Clean ones are the main thread colour; the
 * ones that went wrong are Oops Orange, slipped off their line.
 */
export function Marks({ total, states }: { total: number; states: ('clean' | 'oops' | 'empty')[] }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`${states.filter((s) => s === 'clean').length} of ${total} clean`}>
      {Array.from({ length: total }, (_, i) => {
        const state = states[i] ?? 'empty';
        return (
          <View
            key={i}
            style={[
              styles.mark,
              state === 'empty'
                ? { borderColor: theme.border, borderWidth: 1.5 }
                : { backgroundColor: state === 'oops' ? theme.oops : theme.text },
              state === 'oops' ? { transform: [{ rotate: '8deg' }, { translateY: 2 }] } : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mark: { width: 14, height: 14 },
});
