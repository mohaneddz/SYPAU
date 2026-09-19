import { getNotifications } from '@/utils/notifications';

/**
 * User-facing notifications for transitions and failures.
 *
 * Everything goes through `getNotifications`: importing expo-notifications at
 * module scope throws inside Expo Go, so a static import here would take the
 * whole app down on a device that can otherwise run most of it.
 *
 * These are separate from the activity log. The log records everything; a
 * notification interrupts, so it only fires when the user asked for it.
 */
export async function setupNotificationHandler(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      // A notification announcing that SYPAU just silenced the phone must not
      // be the thing that makes a noise.
      shouldSetBadge: false,
    }),
  });
}

export async function notify(title: string, body: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      // Immediate.
      trigger: null,
    });
  } catch {
    // A notification that won't post is not worth failing a transition over.
  }
}
