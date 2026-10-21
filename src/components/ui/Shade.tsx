import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** A soft black fade over a photo so white text on it stays readable. */
export function Shade({ from, height, strength = 0.75, style }: { from: 'top' | 'bottom'; height: number; strength?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const id = `shade-${from}`;
  return (
    <View pointerEvents="none" style={[styles.base, from === 'top' ? { top: 0 } : { bottom: 0 }, { height }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1={from === 'top' ? '0' : '1'} x2="0" y2={from === 'top' ? '1' : '0'}>
            <Stop offset="0" stopColor={theme.background} stopOpacity={strength} />
            <Stop offset="1" stopColor={theme.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
});
