import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Thin line that runs down over `seconds`. Restarts whenever `runKey` changes. */
export function TimerBar({ seconds, runKey, running }: { seconds: number; runKey: number; running: boolean }) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.setValue(1);
    if (!running) return;
    const anim = Animated.timing(progress, { toValue: 0, duration: seconds * 1000, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [seconds, runKey, running, progress]);

  return (
    <View style={[styles.track, { backgroundColor: theme.border }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: theme.text, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, width: '100%', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%' },
});
