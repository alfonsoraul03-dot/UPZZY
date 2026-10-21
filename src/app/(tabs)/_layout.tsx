import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { useAccess } from '@/hooks/useAccess';
import { useSession } from '@/hooks/useSession';
import { refreshPush, setUpPush } from '@/lib/push';

export default function TabsLayout() {
  const { userId, ready, configured } = useSession();
  const access = useAccess(userId);

  useEffect(setUpPush, []);
  // Keeps this phone's drop push pointing at the signed-in member.
  useEffect(() => {
    if (userId && access) refreshPush().catch(() => {});
  }, [userId, access]);

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
