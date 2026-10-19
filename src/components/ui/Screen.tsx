import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space, useTheme } from '@/theme';

type ScreenProps = ScrollViewProps & {
  /** Rendered above the content, inside the top safe area. */
  header?: React.ReactNode;
  /** Scroll the content (default) or lay it out to fill the screen. */
  scroll?: boolean;
  children: React.ReactNode;
};

/** Standard screen: safe areas, gutters, max width, tab bar clearance. */
export function Screen({ header, scroll = true, children, contentContainerStyle, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const content = [styles.content, { paddingBottom: layout.tabBarHeight + insets.bottom + space.xl }, contentContainerStyle];

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={content} showsVerticalScrollIndicator={false} {...rest}>
          {children}
        </ScrollView>
      ) : (
        <View style={[content, styles.fill]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
});
