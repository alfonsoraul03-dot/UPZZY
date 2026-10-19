import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type Feel = 'tap' | 'found' | 'oops';

/** Small wrapper so screens never crash on devices without haptics (web, simulators). */
export function haptic(feel: Feel) {
  if (Platform.OS === 'web') return;
  const run =
    feel === 'found'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : feel === 'oops'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        : Haptics.selectionAsync();
  run.catch(() => {});
}
