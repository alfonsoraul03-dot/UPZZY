import { useLocalSearchParams } from 'expo-router';

import { Profile } from '@/components/social/Profile';
import { Sheet } from '@/components/ui';
import { useSession } from '@/hooks/useSession';

/** Someone else's profile, opened from their name on a photo or in the ranking. */
export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  return (
    <Sheet title="profile">
      <Profile userId={id} me={userId} />
    </Sheet>
  );
}
