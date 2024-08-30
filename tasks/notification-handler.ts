import { useEngineStore } from '@/state/use-engine-store';
import { useProfileStore } from '@/state/use-profile-store';
import { getNotifications } from '@/utils/notifications';

let installed = false;

/** Call once at startup — no-ops inside Expo Go. See utils/notifications.ts. */
export async function setupNotificationHandler(): Promise<void> {
  if (installed) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  installed = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const { activeProfileId } = useEngineStore.getState();
      const profile = activeProfileId ? useProfileStore.getState().getProfile(activeProfileId) : undefined;
      const intensity = profile?.config.alarmIntensity ?? 'normal';

      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: intensity !== 'silent',
        shouldSetBadge: false,
      };
    },
  });
}
