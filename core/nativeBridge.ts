import { SypauSystem, type GeofenceZoneRegistration, type SystemEvent } from '@/modules/sypauSystem';
import type {
  Capability,
  CapabilityMap,
  ControlKey,
  ControlResult,
  MonitoringStatus,
  PermissionKey,
  PermissionState,
  SystemStateSnapshot,
} from '@/types/capability';
import type { ProfileConfig } from '@/types/profile';
import type { TrackingMode } from '@/types/settings';

export const CONTROL_KEYS: ControlKey[] = [
  'ringerMode',
  'ringVolume',
  'notificationVolume',
  'mediaVolume',
  'alarmVolume',
  'systemVolume',
  'vibration',
  'dnd',
  'wifi',
  'bluetooth',
  'mobileData',
  'airplaneMode',
  'brightness',
  'screenTimeout',
];

export const PERMISSION_KEYS: PermissionKey[] = [
  'locationForeground',
  'locationBackground',
  'locationServicesEnabled',
  'notifications',
  'dndAccess',
  'batteryOptimizationExempt',
  'writeSystemSettings',
];

/** True only in a build that actually contains the Kotlin module. */
export function isNativeAvailable(): boolean {
  return SypauSystem != null;
}

const NO_NATIVE_DETAIL = 'Needs a development build — not available in Expo Go.';

function unsupportedCapabilities(): CapabilityMap {
  return Object.fromEntries(
    CONTROL_KEYS.map((key): [ControlKey, Capability] => [
      key,
      { key, status: 'unsupported', detail: NO_NATIVE_DETAIL },
    ])
  ) as CapabilityMap;
}

export function getCapabilities(): CapabilityMap {
  if (!SypauSystem) return unsupportedCapabilities();

  try {
    const raw = SypauSystem.getCapabilities();
    return Object.fromEntries(
      CONTROL_KEYS.map((key): [ControlKey, Capability] => {
        const entry = raw[key];
        return [
          key,
          entry
            ? { key, status: entry.status, detail: entry.detail }
            : { key, status: 'unsupported', detail: 'Not available on this device.' },
        ];
      })
    ) as CapabilityMap;
  } catch {
    return unsupportedCapabilities();
  }
}

export function getPermissions(): Record<PermissionKey, PermissionState> {
  const fallback = Object.fromEntries(
    PERMISSION_KEYS.map((key): [PermissionKey, PermissionState] => [
      key,
      { key, granted: false, canRequestInApp: false },
    ])
  ) as Record<PermissionKey, PermissionState>;

  if (!SypauSystem) return fallback;

  try {
    const raw = SypauSystem.getPermissions();
    return Object.fromEntries(
      PERMISSION_KEYS.map((key): [PermissionKey, PermissionState] => {
        const entry = raw[key];
        return [
          key,
          entry
            ? { key, granted: entry.granted, canRequestInApp: entry.canRequestInApp }
            : { key, granted: false, canRequestInApp: false },
        ];
      })
    ) as Record<PermissionKey, PermissionState>;
  } catch {
    return fallback;
  }
}

export function getSystemState(): SystemStateSnapshot | null {
  if (!SypauSystem) return null;
  try {
    return SypauSystem.getSystemState();
  } catch {
    return null;
  }
}

/**
 * Apply a profile's config. Without a native build every control reports
 * `unsupported` rather than a fabricated success — the UI shows that plainly.
 */
export function applyProfile(config: ProfileConfig): {
  results: ControlResult[];
  snapshot: SystemStateSnapshot | null;
} {
  if (!SypauSystem) {
    return {
      results: CONTROL_KEYS.map((key) => ({
        key,
        outcome: 'unsupported' as const,
        message: NO_NATIVE_DETAIL,
      })),
      snapshot: null,
    };
  }

  try {
    const { results, snapshot } = SypauSystem.applyProfile(
      config as unknown as Record<string, unknown>
    );
    return { results, snapshot };
  } catch (error) {
    return {
      results: [
        {
          key: 'dnd',
          outcome: 'failed',
          message: error instanceof Error ? error.message : 'Couldn’t apply this profile.',
        },
      ],
      snapshot: null,
    };
  }
}

export function restoreSystemState(
  snapshot: SystemStateSnapshot,
  keys: ControlKey[]
): ControlResult[] {
  if (!SypauSystem || keys.length === 0) return [];
  try {
    return SypauSystem.restoreSystemState(snapshot, keys);
  } catch {
    return [];
  }
}

export function isBatteryOptimized(): boolean {
  if (!SypauSystem) return false;
  try {
    return SypauSystem.isBatteryOptimized();
  } catch {
    return false;
  }
}

export function isLocationEnabled(): boolean {
  if (!SypauSystem) return true;
  try {
    return SypauSystem.isLocationEnabled();
  } catch {
    return true;
  }
}

type SettingsTarget =
  | 'dnd'
  | 'notifications'
  | 'location'
  | 'app'
  | 'writeSettings'
  | 'wifi'
  | 'bluetooth'
  | 'mobileData'
  | 'airplaneMode'
  | 'batteryOptimization';

/** Opens the Android screen that owns a setting SYPAU can't change itself. */
export function openSettings(target: SettingsTarget): boolean {
  if (!SypauSystem) return false;

  try {
    switch (target) {
      case 'dnd':
        return SypauSystem.openDndSettings();
      case 'notifications':
        return SypauSystem.openNotificationSettings();
      case 'location':
        return SypauSystem.openLocationSettings();
      case 'app':
        return SypauSystem.openAppSettings();
      case 'writeSettings':
        return SypauSystem.openWriteSettings();
      case 'wifi':
        return SypauSystem.openWifiPanel();
      case 'bluetooth':
        return SypauSystem.openBluetoothSettings();
      case 'mobileData':
        return SypauSystem.openMobileDataSettings();
      case 'airplaneMode':
        return SypauSystem.openAirplaneModeSettings();
      case 'batteryOptimization':
        return SypauSystem.openBatteryOptimizationSettings();
    }
  } catch {
    return false;
  }
}

export async function registerGeofences(zones: GeofenceZoneRegistration[]): Promise<number> {
  if (!SypauSystem) return 0;
  return SypauSystem.registerGeofences(zones);
}

export async function clearGeofences(): Promise<boolean> {
  if (!SypauSystem) return false;
  return SypauSystem.clearGeofences();
}

export function startMonitoring(mode: TrackingMode, zoneName: string | null): boolean {
  if (!SypauSystem) return false;
  try {
    return SypauSystem.startMonitoring(mode, zoneName);
  } catch {
    return false;
  }
}

/**
 * Mirror the boot preference into native storage, so the receiver can act at
 * boot without a JS runtime.
 */
export function setStartOnBoot(enabled: boolean, mode: TrackingMode): void {
  if (!SypauSystem) return;
  try {
    SypauSystem.setStartOnBoot(enabled, mode);
  } catch {
    // Nothing to recover: a device that refuses this simply won't re-arm on
    // boot, and the settings screen already says monitoring may need a nudge.
  }
}

export function stopMonitoring(): boolean {
  if (!SypauSystem) return false;
  try {
    return SypauSystem.stopMonitoring();
  } catch {
    return false;
  }
}

export function updateMonitoringNotification(zoneName: string | null): void {
  if (!SypauSystem) return;
  try {
    SypauSystem.updateMonitoringNotification(zoneName);
  } catch {
    // The notification text is cosmetic; a failure here must not break a
    // transition that otherwise succeeded.
  }
}

export function getMonitoringStatus(): MonitoringStatus {
  const idle: MonitoringStatus = {
    running: false,
    registeredGeofences: 0,
    trackingMode: 'balanced',
    startedAt: null,
    updateCount: 0,
    lastHeartbeatAt: null,
  };

  if (!SypauSystem) return idle;
  try {
    return SypauSystem.getMonitoringStatus();
  } catch {
    return idle;
  }
}

export function subscribeToSystemEvents(listener: (event: SystemEvent) => void): () => void {
  if (!SypauSystem) return () => {};

  const subscription = SypauSystem.addListener('onSystemEvent', listener);
  return () => subscription.remove();
}

export type { SystemEvent, GeofenceZoneRegistration };
