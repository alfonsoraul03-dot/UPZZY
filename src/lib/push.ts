import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * The push when the daily challenge drops. The phone gives us an Expo push
 * token; the database sends the push to every member at the drop (see
 * supabase/migrations/20261024000000_push.sql).
 */

export type PushState = 'on' | 'off' | 'ask' | 'unsupported';

/** Set once the phone is registered, so signing out can remove it. */
let savedToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Pushes need a real phone and an EAS project (set by `eas init`). */
function supported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice && !!projectId();
}

/** Shows the push even with the app open, and opens home when tapped. */
export function setUpPush(): () => void {
  if (Platform.OS === 'web') return () => {};
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('drop', {
      name: 'daily drop',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.navigate(url as never);
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'on';
  return canAskAgain ? 'ask' : 'off';
}

async function save(): Promise<void> {
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const { error } = await supabase!.rpc('save_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) throw error;
  savedToken = token;
}

/** Asks for permission (only if needed) and saves this phone. */
export async function turnOnPush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'off';
  await save();
  return 'on';
}

/** On launch: if pushes are already allowed, keep the token up to date. */
export async function refreshPush(): Promise<void> {
  if ((await pushState()) === 'on') await save();
}

/** Before signing out, so the next person on this phone isn't told about your account. */
export async function forgetPush(): Promise<void> {
  if (!savedToken || !supabase) return;
  await supabase.rpc('remove_push_token', { p_token: savedToken });
  savedToken = null;
}
