import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { useAccess } from '@/hooks/useAccess';
import { useConsents } from '@/hooks/useConsents';
import { useSession } from '@/hooks/useSession';
import { refreshPush, setUpPush } from '@/lib/push';

export default function TabsLayout() {
  const { userId, ready, configured } = useSession();
  const access = useAccess(userId);
  const consents = useConsents(userId);

  useEffect(setUpPush, []);
  // Keeps this phone's drop push pointing at the signed-in member.
  useEffect(() => {
    if (userId && access) refreshPush().catch(() => {});
  }, [userId, access]);

  // Sign in, say you're 18+, answer about social media, then the code from the package.
  // The server enforces the age and the code too.
  if (configured && ready && !userId) return <Redirect href="/sign-in" />;
  if (configured && ready && consents && !consents.adult) return <Redirect href="/age" />;
  if (configured && ready && consents && !consents.social_answered) return <Redirect href="/consent" />;
  if (configured && ready && access === false) return <Redirect href="/unlock" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
