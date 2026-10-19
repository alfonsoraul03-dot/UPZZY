import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Text } from '@/components/ui';
import { fonts, useTheme } from '@/theme';

/**
 * The UPZZY mark: a solid tag with an upward arrow cut out of it.
 * Same geometry as `assets/brand/upzzy-mark.svg`.
 */
export function LogoMark({ size = 28, color, cutout }: { size?: number; color?: string; cutout?: string }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="UPZZY">
      <Rect width={32} height={32} fill={color ?? theme.text} />
      <Path d="M16 6 25 15h-5.5v11h-7V15H7z" fill={cutout ?? theme.background} />
    </Svg>
  );
}

type LogoProps = { size?: number; showMark?: boolean; color?: string };

/** Mark + wordmark lockup. */
export function Logo({ size = 22, showMark = true, color }: LogoProps) {
  const theme = useTheme();
  const ink = color ?? theme.text;
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="UPZZY">
      {showMark ? <LogoMark size={size * 1.15} color={ink} /> : null}
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: size * 1.05,
          letterSpacing: size * 0.02,
          color: ink,
        }}>
        UPZZY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
