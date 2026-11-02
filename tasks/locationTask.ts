import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK_NAME } from '@/core/monitoring';
import { syncStatusNotification } from '@/core/statusNotification';
import { applyTransition, INITIAL_ENGINE_STATE, resolveActiveZone, type EngineState } from '@/core/zoneEngine';
import { loadEngineState, saveEngineState } from '@/db/engineState';
import { loadSettings } from '@/db/settings';
import { listProfiles } from '@/db/profiles';
import { getZone, listZones } from '@/db/zones';

/**
 * Background location handler.
 *
 * Defined at module scope so it survives the cold start Android performs when
 * it wakes the app for a location update — a task registered inside a
 * component would not exist yet at that point.
 *
 * Engine state lives in module scope for the same reason. The process may be
 * torn down between updates, so a cold start reloads what was persisted rather
 * than assuming nothing was active.
 */
let backgroundState: EngineState = INITIAL_ENGINE_STATE;
let backgroundLoaded = false;
let backgroundDwell: Record<string, number> = {};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    const settings = loadSettings();
    if (!settings.automationEnabled) return;

    if (!backgroundLoaded) {
      backgroundState = loadEngineState();
      backgroundLoaded = true;
    }

    const zones = listZones();
    const profiles = listProfiles();
    const position = {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
    };

    const previousActiveZone = backgroundState.activeZoneId
      ? getZone(backgroundState.activeZoneId)
      : null;

    const outcome = resolveActiveZone({
      position,
      zones,
      profiles,
      settings,
      state: backgroundState,
      dwellSince: backgroundDwell,
    });

    backgroundDwell = outcome.dwellSince;
    backgroundState = applyTransition({
      outcome,
      previousActiveZone,
      profiles,
      settings,
      state: backgroundState,
    });
    saveEngineState(backgroundState);
    await syncStatusNotification({ state: backgroundState, settings, zones, profiles });
  } catch {
    // A throw here would have Android treat the task as misbehaving and back
    // off from waking us; losing one update is the lesser cost.
  }
});

/** Lets the foreground hand its current state to the background task. */
export function seedBackgroundState(state: EngineState): void {
  backgroundState = state;
  backgroundLoaded = true;
}

export function getBackgroundState(): EngineState {
  return backgroundState;
}
