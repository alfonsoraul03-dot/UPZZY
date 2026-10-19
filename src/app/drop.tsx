import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Sheet, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, radius, space, useTheme } from '@/theme';

/** Prices and stock live on the store, so the app links there instead of copying them. */
const DROP_URL = 'https://www.upzzyworld.com/collections/drop-001';

const PIECES = [
  { name: 'slip tee', line: 'front: the slip. back: the confession.', Art: SlipArt },
  { name: 'offset tee', line: 'a circle and its outline that never agreed.', Art: OffsetArt },
  { name: 'typo hoodie', line: 'spelled wrong. fits right.', Art: TypoArt },
];

export default function DropScreen() {
  const theme = useTheme();
  const open = () => {
    haptic('tap');
    WebBrowser.openBrowserAsync(DROP_URL);
  };

  return (
    <Sheet title="shop">
      <View style={styles.intro}>
        <Text variant="label" color="textMuted">
          drop 001
        </Text>
        <Text variant="title">three things. that&apos;s it.</Text>
        <Text color="textMuted">50 of each colour. numbered. never restocked.</Text>
      </View>

      <View style={styles.list}>
        {PIECES.map(({ name, line, Art }) => (
          <Pressable
            key={name}
            onPress={open}
            accessibilityRole="link"
            accessibilityLabel={`${name}, open in the UPZZY store`}
            style={({ pressed }) => [styles.piece, { backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.art, { borderColor: theme.border }]}>
              <Art />
            </View>
            <View style={styles.pieceText}>
              <Text variant="bodyStrong">{name}</Text>
              <Text variant="caption" color="textMuted">
                {line}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Button label="see the drop" onPress={open} />

      <View style={styles.footer}>
        <Text variant="caption" color="textMuted">
          made by mistake. worn on purpose.
        </Text>
      </View>
    </Sheet>
  );
}

function SlipArt() {
  const theme = useTheme();
  const letter = { fontFamily: fonts.display, fontSize: 15, color: theme.text };
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={letter}>UPZ</Text>
      <Text style={[letter, { color: theme.oops, transform: [{ rotate: '8deg' }, { translateY: 1 }] }]}>Z</Text>
      <Text style={letter}>Y</Text>
    </View>
  );
}

function OffsetArt() {
  const theme = useTheme();
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48">
      <Circle cx={22} cy={26} r={12} fill={theme.text} />
      <Circle cx={27} cy={21} r={13} fill="none" stroke={theme.oops} strokeWidth={2.5} />
    </Svg>
  );
}

function TypoArt() {
  const theme = useTheme();
  const letter = { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: theme.text };
  const fix = { fontFamily: fonts.display, color: theme.oops };
  // "UPZY" with the missing Z inserted above an orange caret: the typo, fixed.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={letter}>UPZ</Text>
      <View style={{ alignItems: 'center', width: 8, marginTop: -2 }}>
        <Text style={[fix, { fontSize: 9, lineHeight: 10 }]}>Z</Text>
        <Text style={[fix, { fontSize: 11, lineHeight: 11, marginTop: 10 }]}>^</Text>
      </View>
      <Text style={letter}>Y</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm, paddingTop: space.lg },
  list: { gap: space.md },
  piece: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.md },
  art: { width: 76, height: 76, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pieceText: { flex: 1, gap: space.xxs },
  footer: { alignItems: 'center', paddingTop: space.md },
});
