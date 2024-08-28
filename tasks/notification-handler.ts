import * as Notifications from 'expo-notifications';

import { useEngineStore } from '@/state/use-engine-store';
import { useProfileStore } from '@/state/use-profile-store';

// Registered at module scope so alarm notifications behave consistently
// even when this fires before any screen has mounted.
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
