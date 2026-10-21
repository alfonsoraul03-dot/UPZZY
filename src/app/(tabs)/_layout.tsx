import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';
import { useAccess } from '@/hooks/useAccess';
import { useSession } from '@/hooks/useSession';

export default function TabsLayout() {
  const { userId, ready, configured } = useSession();
  const access = useAccess(userId);

  // Only people who bought a piece get in. The server enforces it too.
  if (configured && ready && (!userId || access === false)) return <Redirect href="/unlock" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
