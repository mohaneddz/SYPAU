import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { SETTINGS_KEYS } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import { getSetting, insertEvent, listFolds, setSetting } from '@/db/queries';
import { activeFoldSet, resolveFold } from '@/engine/overlap';

export const LOCATION_TASK_NAME = 'SYPAU_LOCATION_TASK';

const HYSTERESIS_BUFFER_METERS = 15;

type BackgroundEngineState = {
  confirmedFoldId: string | null;
  pendingFoldId: string | null;
  pendingSince: number | null;
};

const INITIAL_BG_STATE: BackgroundEngineState = { confirmedFoldId: null, pendingFoldId: null, pendingSince: null };

// Registered at module scope so it survives cold starts triggered by the OS in the background.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { locations } = (data ?? {}) as { locations: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const db = getDb();
  const folds = listFolds(db);
  const point = { latitude: latest.coords.latitude, longitude: latest.coords.longitude };
  const candidates = activeFoldSet(point, folds, HYSTERESIS_BUFFER_METERS);
  const rawResolvedFoldId = resolveFold(candidates)?.id ?? null;

  const now = Date.now();
  const bgState = getSetting<BackgroundEngineState>(db, SETTINGS_KEYS.engineBackgroundState, INITIAL_BG_STATE);

  if (rawResolvedFoldId === bgState.confirmedFoldId) {
    if (bgState.pendingFoldId !== null) {
      setSetting(db, SETTINGS_KEYS.engineBackgroundState, { ...bgState, pendingFoldId: null, pendingSince: null });
    }
    return;
  }

  const pendingSince =
    bgState.pendingFoldId === rawResolvedFoldId && bgState.pendingSince ? bgState.pendingSince : now;
  const enteringFold = rawResolvedFoldId ? folds.find((f) => f.id === rawResolvedFoldId) : null;
  const exitingFold = bgState.confirmedFoldId ? folds.find((f) => f.id === bgState.confirmedFoldId) : null;
  const requiredDwell = rawResolvedFoldId ? (enteringFold?.dwellEnterMs ?? 0) : (exitingFold?.dwellExitMs ?? 0);

  if (now - pendingSince < requiredDwell) {
    setSetting(db, SETTINGS_KEYS.engineBackgroundState, {
      ...bgState,
      pendingFoldId: rawResolvedFoldId,
      pendingSince,
    });
    return;
  }

  const prev = bgState.confirmedFoldId;
  const next = rawResolvedFoldId;

  if (prev === null && next !== null) {
    insertEvent(db, { ts: now, type: 'ENTER', foldId: next, payload: { source: 'background' } });
  } else if (prev !== null && next === null) {
    insertEvent(db, { ts: now, type: 'EXIT', foldId: prev, payload: { source: 'background' } });
  } else if (prev !== null && next !== null) {
    insertEvent(db, { ts: now, type: 'RESOLVE_CHANGE', foldId: next, payload: { from: prev, to: next, source: 'background' } });
  }

  setSetting(db, SETTINGS_KEYS.engineBackgroundState, { confirmedFoldId: next, pendingFoldId: null, pendingSince: null });
});
