import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space, useTheme } from '@/theme';

type ScreenProps = ScrollViewProps & {
  /** Rendered above the scrolling content, inside the top safe area. */
  header?: React.ReactNode;
  children: React.ReactNode;
};

/** Standard scrolling screen: safe areas, gutters, max content width, tab bar clearance. */
export function Screen({ header, children, contentContainerStyle, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: layout.tabBarHeight + insets.bottom + space.xxl },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        {...rest}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: space.xxl,
  },
});
