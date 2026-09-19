import { NativeModule, requireOptionalNativeModule } from 'expo';

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
import type { TrackingMode } from '@/types/settings';

export type GeofenceZoneRegistration = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type SystemEvent =
  | {
      type: 'geofenceEnter' | 'geofenceExit';
      timestamp: number;
      zoneIds: string[];
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
    }
  | { type: 'geofenceError'; timestamp: number; message: string }
  | { type: 'serviceHealth'; timestamp: number; running: boolean };

type SypauSystemEvents = {
  onSystemEvent: (event: SystemEvent) => void;
};

declare class SypauSystemModuleType extends NativeModule<SypauSystemEvents> {
  getCapabilities(): Record<ControlKey, { status: Capability['status']; detail: string }>;
  getPermissions(): Record<PermissionKey, { granted: boolean; canRequestInApp: boolean }>;
  getSystemState(): SystemStateSnapshot;
  applyProfile(config: Record<string, unknown>): {
    results: ControlResult[];
    snapshot: SystemStateSnapshot;
  };
  restoreSystemState(snapshot: SystemStateSnapshot, keys: ControlKey[]): ControlResult[];

  isBatteryOptimized(): boolean;
  isLocationEnabled(): boolean;

  openDndSettings(): boolean;
  openNotificationSettings(): boolean;
  openLocationSettings(): boolean;
  openAppSettings(): boolean;
  openWriteSettings(): boolean;
  openWifiPanel(): boolean;
  openBluetoothSettings(): boolean;
  openMobileDataSettings(): boolean;
  openAirplaneModeSettings(): boolean;
  openBatteryOptimizationSettings(): boolean;

  registerGeofences(zones: GeofenceZoneRegistration[]): Promise<number>;
  clearGeofences(): Promise<boolean>;

  startMonitoring(mode: TrackingMode, zoneName: string | null): boolean;
  stopMonitoring(): boolean;
  updateMonitoringNotification(zoneName: string | null): boolean;
  getMonitoringStatus(): MonitoringStatus;
}

/**
 * Optional on purpose: the app still has to render in Expo Go and in the test
 * environment, where no native build exists. Callers go through
 * `core/nativeBridge.ts`, which supplies honest "unsupported" answers when this
 * is null rather than letting the UI claim a capability it doesn't have.
 */
export const SypauSystem = requireOptionalNativeModule<SypauSystemModuleType>('SypauSystem');

export type { Capability, CapabilityMap, ControlResult, PermissionState };
