import { StyleSheet, View } from 'react-native';

import { isPlaceholderUsername } from '@/social/rules';
import { avatarColors, fonts, palette, useTheme } from '@/theme';

import { Text } from './Text';

/** A circle with the first letter of the name. People have no profile photo yet. */
export function Avatar({ name, size = 40, ring }: { name: string | null; size?: number; ring?: string }) {
  const theme = useTheme();
  const real = name && !isPlaceholderUsername(name) ? name : null;
  const hash = [...(real ?? '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: real ? avatarColors[hash % avatarColors.length] : theme.surface,
          borderColor: ring ?? 'transparent',
          borderWidth: ring ? Math.max(2, size / 24) : 0,
        },
      ]}
      accessible={false}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.42, lineHeight: size * 0.52, color: real ? palette.black : theme.textMuted }}>
        {(real ?? '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
