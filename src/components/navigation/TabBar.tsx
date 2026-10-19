import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, layout, useTheme } from '@/theme';

/** Route name → label. The order of routes comes from `(tabs)/_layout.tsx`. */
export const TABS: Record<string, string> = {
  index: 'today',
  play: 'play',
  drop: 'drop',
};

/** Three quiet lowercase words. The active one gets a small dot under it. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const label = TABS[route.name];
        if (!label) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('tap');
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.tab}>
            <Text style={[styles.label, { color: focused ? theme.text : theme.textMuted, fontFamily: focused ? fonts.bodySemiBold : fonts.body }]}>
              {label}
            </Text>
            <View style={[styles.dot, { backgroundColor: focused ? theme.text : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: layout.tabBarHeight, alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
