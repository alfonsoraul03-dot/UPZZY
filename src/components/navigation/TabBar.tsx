import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, layout, radius, useTheme } from '@/theme';

/** Route name → label and icon. The order of routes comes from `(tabs)/_layout.tsx`. */
export const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'home', icon: 'home' },
  ranking: { label: 'ranking', icon: 'ranking' },
  chats: { label: 'chats', icon: 'chat' },
  you: { label: 'you', icon: 'user' },
};

/** Icons with small labels, and the camera in the middle for today's challenge. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? theme.text : theme.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('tap');
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Fragment key={route.key}>
            <Pressable
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.tab}>
              <Icon name={tab.icon} color={color} size={25} weight={focused ? 2.3 : 1.8} />
              <Text style={[styles.label, { color, fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium }]}>{tab.label}</Text>
            </Pressable>
            {route.name === 'ranking' ? (
              <View style={styles.tab}>
                <Pressable
                  onPress={() => {
                    haptic('tap');
                    router.push('/capture');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="take today's photo"
                  style={({ pressed }) => [styles.camera, { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }]}>
                  <Icon name="camera" color={theme.onText} size={22} weight={2.2} />
                </Pressable>
              </View>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: layout.tabBarHeight, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10.5, lineHeight: 13 },
  camera: { width: 54, height: 36, borderRadius: radius.md + 4, alignItems: 'center', justifyContent: 'center' },
});
