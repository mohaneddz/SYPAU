import { useEffect, useRef } from 'react';

import { getDb } from '@/db/client';
import { insertEvent } from '@/db/queries';
import { createInitialEngineState, tickFieldEngine } from '@/engine/field-engine';
import type { LatLng } from '@/engine/geo';
import { activeFoldSet, resolveFold } from '@/engine/overlap';
import { useEngineStore } from '@/state/use-engine-store';
import type { Fold } from '@/types/fold';

const HYSTERESIS_BUFFER_METERS = 15;

/** Drives the Field Engine (dwell, drift-holding, restore) from a live location stream. */
export function useFieldEngine(currentLocation: LatLng | null, folds: Fold[]) {
  const stateRef = useRef(createInitialEngineState());
  const hasLoggedRestart = useRef(false);

  useEffect(() => {
    if (hasLoggedRestart.current) return;
    hasLoggedRestart.current = true;
    const db = getDb();
    insertEvent(db, { ts: Date.now(), type: 'ENGINE_RESTART', foldId: null, payload: {} });
  }, []);

  useEffect(() => {
    if (!currentLocation) return;

    const candidates = activeFoldSet(currentLocation, folds, HYSTERESIS_BUFFER_METERS);
    const rawResolvedFoldId = resolveFold(candidates)?.id ?? null;

    const { state: nextState, events } = tickFieldEngine(stateRef.current, Date.now(), rawResolvedFoldId, folds);
    stateRef.current = nextState;

    if (events.length > 0) {
      const db = getDb();
      for (const event of events) insertEvent(db, event);
    }

    const engineStore = useEngineStore.getState();
    engineStore.setResolvedFoldId(nextState.confirmedFoldId);
    engineStore.setActiveProfileId(nextState.activeOverride?.profileId ?? null);
    engineStore.setStatus(nextState.holding ? 'holding' : 'armed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, folds]);
}
