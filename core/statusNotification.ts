import type { EngineState } from '@/core/zoneEngine';
import type { Profile } from '@/types/profile';
import type { AppSettings, StatusNotificationMode } from '@/types/settings';
import type { Zone } from '@/types/zone';
import { getNotifications } from '@/utils/notifications';

const STATUS_ID = 'sypauStatus';
const STATUS_CHANNEL = 'sypauStatus';

export const STATUS_NOTIFICATION_OPTIONS: { value: StatusNotificationMode; label: string; sublabel: string }[] = [
  { value: 'off', label: 'Off', sublabel: 'Never' },
  { value: 'inZone', label: 'In a zone', sublabel: 'Any zone' },
  { value: 'profileActive', label: 'In a mode', sublabel: 'Not default' },
  { value: 'always', label: 'Always', sublabel: 'Pinned' },
];

type StatusInput = {
  state: EngineState;
  settings: AppSettings;
  zones: Zone[];
  profiles: Profile[];
};

/** What the pinned notification should say, or null when it shouldn't be up. */
export function statusContent({ state, settings, zones, profiles }: StatusInput): {
  title: string;
  body: string;
} | null {
  const zone = zones.find((entry) => entry.id === state.activeZoneId) ?? null;
  const defaultProfile =
    profiles.find((p) => p.id === settings.defaultProfileId) ??
    profiles.find((p) => p.isDefault) ??
    null;
  const profile = (zone && profiles.find((p) => p.id === zone.profileId)) ?? defaultProfile;
  const inMode = profile !== null && profile.id !== defaultProfile?.id;

  const show =
    settings.statusNotification === 'always' ||
    (settings.statusNotification === 'inZone' && zone !== null) ||
    (settings.statusNotification === 'profileActive' && inMode);
  if (!show) return null;

  if (!settings.automationEnabled) {
    return { title: 'SYPAU is paused', body: 'Zones won’t change your phone until you turn it back on.' };
  }
  if (zone) {
    return {
      title: `${profile?.name ?? 'No profile'} · ${zone.name}`,
      body: 'SYPAU is holding your phone to this profile until you leave.',
    };
  }
  return {
    title: profile ? `${profile.name} · outside your zones` : 'SYPAU is watching',
    body: 'Your phone is yours. SYPAU steps in when you cross a boundary.',
  };
}

let shown: string | null = null;

/**
 * Puts up, updates or takes down the pinned status notification. Called from
 * wherever the engine runs, foreground or background, so it follows the state
 * rather than the screen. Skips the post when nothing changed, which would
 * otherwise re-announce the same text on every location fix.
 */
export async function syncStatusNotification(input: StatusInput): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const content = statusContent(input);
  const key = content ? `${content.title}\n${content.body}` : null;
  if (key === shown) return;

  try {
    if (!content) {
      await Notifications.dismissNotificationAsync(STATUS_ID);
      shown = null;
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    // Low importance: it sits in the shade without sound, vibration or a banner.
    await Notifications.setNotificationChannelAsync(STATUS_CHANNEL, {
      name: 'Status',
      description: 'The pinned notification showing what SYPAU is doing.',
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
      enableVibrate: false,
      sound: null,
    });

    await Notifications.scheduleNotificationAsync({
      identifier: STATUS_ID,
      content: {
        title: content.title,
        body: content.body,
        sound: false,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: { channelId: STATUS_CHANNEL },
    });
    shown = key;
  } catch {
    // The status line is a convenience; failing to post it changes nothing else.
  }
}
