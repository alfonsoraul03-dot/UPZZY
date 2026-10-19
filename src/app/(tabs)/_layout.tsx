import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="challenges" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
