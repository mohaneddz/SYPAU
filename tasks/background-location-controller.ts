import * as Location from 'expo-location';

import type { LocationAccuracyPreset } from '@/constants/settings-keys';
import { LOCATION_TASK_NAME } from '@/tasks/location-task';

const ACCURACY_PRESETS: Record<LocationAccuracyPreset, { accuracy: Location.Accuracy; timeInterval: number; distanceInterval: number }> = {
  battery: { accuracy: Location.Accuracy.Low, timeInterval: 30_000, distanceInterval: 100 },
  balanced: { accuracy: Location.Accuracy.Balanced, timeInterval: 20_000, distanceInterval: 75 },
  precise: { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 30 },
};

export async function startBackgroundLocation(preset: LocationAccuracyPreset): Promise<void> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

  const { accuracy, timeInterval, distanceInterval } = ACCURACY_PRESETS[preset];
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy,
    timeInterval,
    distanceInterval,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'SYPAU is watching for Folds',
      notificationBody: 'Monitoring your location to apply the right profile.',
    },
  });
}

export async function stopBackgroundLocation(): Promise<void> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}
