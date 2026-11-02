import * as Location from 'expo-location';

import { registerGeofences, startMonitoring, stopMonitoring } from '@/core/nativeBridge';
import { latestEventTitle, logEvent } from '@/db/events';
import { boundingCircle } from '@/utils/geometry';
import type { TrackingMode } from '@/types/settings';
import type { Zone } from '@/types/zone';

export const LOCATION_TASK_NAME = 'sypauLocationTask';

const WATCH_FAILED = 'Couldn’t watch your zones';
const WATCH_RECOVERED = 'Watching your zones again';

/**
 * How hard each mode works for a fix.
 *
 * Even "high accuracy" is a 10 s interval rather than continuous streaming:
 * zone boundaries are tens of metres wide, so a faster cadence buys nothing but
 * battery drain. Genuinely continuous tracking is a debug-only concern.
 */
const TRACKING_PRESETS: Record<
  TrackingMode,
  { accuracy: Location.Accuracy; timeInterval: number; distanceInterval: number }
> = {
  batterySaver: { accuracy: Location.Accuracy.Low, timeInterval: 60_000, distanceInterval: 150 },
  balanced: { accuracy: Location.Accuracy.Balanced, timeInterval: 25_000, distanceInterval: 75 },
  highAccuracy: { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 25 },
};

/**
 * Hand the enabled zones to the platform geofencing service.
 *
 * Polygons register as their bounding circle — the platform only understands
 * circles. The precise containment test runs in the engine once a transition
 * wakes us, so this is a pre-filter rather than the boundary itself.
 */
export async function syncGeofences(zones: Zone[]): Promise<number> {
  const registrations = zones
    .filter((zone) => zone.enabled)
    .map((zone) => {
      if (zone.geometry.type === 'circle') {
        return {
          id: zone.id,
          latitude: zone.geometry.center.latitude,
          longitude: zone.geometry.center.longitude,
          radiusMeters: zone.geometry.radiusMeters,
        };
      }

      const circle = boundingCircle(zone.geometry.points);
      if (!circle) return null;

      return {
        id: zone.id,
        latitude: circle.center.latitude,
        longitude: circle.center.longitude,
        // Padded so the platform wakes us slightly before the real boundary.
        radiusMeters: circle.radiusMeters + 50,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  try {
    const registered = await registerGeofences(registrations);
    // Without this the failure stays the last word in the log, and on the
    // home screen, long after the cause was fixed.
    if (registered > 0 && latestEventTitle([WATCH_FAILED, WATCH_RECOVERED]) === WATCH_FAILED) {
      logEvent({
        category: 'system',
        title: WATCH_RECOVERED,
        description: `${registered} ${registered === 1 ? 'zone is' : 'zones are'} being watched.`,
        severity: 'success',
      });
    }
    return registered;
  } catch (error) {
    logEvent({
      category: 'error',
      title: WATCH_FAILED,
      description:
        error instanceof Error ? error.message : 'Android refused to register your zones.',
      severity: 'error',
    });
    return 0;
  }
}

/**
 * Start watching. Background location updates only run when the mode actually
 * needs them — in balanced and battery-saver, platform geofencing alone covers
 * transitions at a fraction of the cost.
 */
export async function startZoneMonitoring(
  mode: TrackingMode,
  zones: Zone[],
  activeZoneName: string | null
): Promise<boolean> {
  await syncGeofences(zones);
  startMonitoring(mode, activeZoneName);

  if (mode !== 'highAccuracy') {
    await stopLocationUpdates();
    return true;
  }

  const preset = TRACKING_PRESETS[mode];

  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      ...preset,
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'SYPAU',
        notificationBody: activeZoneName
          ? `Silence is active in ${activeZoneName}.`
          : 'Watching your zones.',
      },
    });
    return true;
  } catch (error) {
    logEvent({
      category: 'error',
      title: 'Background monitoring stopped',
      description:
        error instanceof Error ? error.message : 'Android wouldn’t start location updates.',
      severity: 'error',
    });
    return false;
  }
}

export async function stopZoneMonitoring(): Promise<void> {
  await stopLocationUpdates();
  stopMonitoring();
}

async function stopLocationUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // Nothing was running, which is the state we wanted anyway.
  }
}

export async function isLocationUpdatesRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

export function trackingPresetFor(mode: TrackingMode) {
  return TRACKING_PRESETS[mode];
}
