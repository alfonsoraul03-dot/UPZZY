import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChallengeIcon, CommunityIcon, HomeIcon, PlusIcon, ProfileIcon, type IconProps } from '@/components/brand/icons';
import { Text } from '@/components/ui';
import { layout, space, useTheme } from '@/theme';

type TabConfig = { label: string; Icon: (props: IconProps) => React.ReactElement };

/** Route name → label and icon. The order of routes comes from `(tabs)/_layout.tsx`. */
export const TABS: Record<string, TabConfig> = {
  index: { label: 'Home', Icon: HomeIcon },
  challenges: { label: 'Challenges', Icon: ChallengeIcon },
  create: { label: 'Create', Icon: PlusIcon },
  community: { label: 'Community', Icon: CommunityIcon },
  profile: { label: 'Profile', Icon: ProfileIcon },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}>
      {state.routes.map((route, index) => {
        const config = TABS[route.name];
        if (!config) return null;
        const focused = state.index === index;
        const isCreate = route.name === 'create';
        const color = focused ? theme.text : theme.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={config.label}
            style={styles.tab}>
            {isCreate ? (
              <View style={[styles.create, { backgroundColor: focused ? theme.accent : theme.inverse }]}>
                <config.Icon size={22} color={focused ? theme.onAccent : theme.onInverse} strokeWidth={2.25} />
              </View>
            ) : (
              <>
                <config.Icon size={22} color={color} />
                <Text variant="label" style={[styles.label, { color }]}>
                  {config.label}
                </Text>
                <View style={[styles.indicator, { backgroundColor: focused ? theme.accent : 'transparent' }]} />
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    height: layout.tabBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: { fontSize: 9, letterSpacing: 0.8 },
  indicator: { position: 'absolute', top: 0, width: 20, height: 2 },
  create: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center' },
});
