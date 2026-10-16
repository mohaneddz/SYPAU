import { INITIAL_ENGINE_STATE, type EngineState } from '@/core/zoneEngine';
import { getDb } from '@/db/client';

const KEY = 'engineState';

/**
 * The part of the engine that has to outlive the process. Without it, a
 * relaunch inside a zone reads as walking in again — the profile re-applies and
 * re-notifies — and, worse, the snapshot of how the phone was before SYPAU
 * touched it is gone, so leaving can no longer put it back.
 *
 * Per-zone runtime state and the last apply results are rebuilt from the next
 * fix, so they aren't kept.
 */
type PersistedEngineState = Pick<
  EngineState,
  'activeZoneId' | 'matchedZoneIds' | 'snapshot' | 'ownedKeys' | 'activeSince'
>;

function persistedPart(state: EngineState): PersistedEngineState {
  return {
    activeZoneId: state.activeZoneId,
    matchedZoneIds: state.matchedZoneIds,
    snapshot: state.snapshot,
    ownedKeys: state.ownedKeys,
    activeSince: state.activeSince,
  };
}

let lastWritten: string | null = null;

export function loadEngineState(): EngineState {
  try {
    const row = getDb().getFirstSync<{ value: string }>(
      'SELECT value FROM appSettings WHERE key = ?',
      KEY
    );
    if (!row) return INITIAL_ENGINE_STATE;

    lastWritten = row.value;
    return { ...INITIAL_ENGINE_STATE, ...(JSON.parse(row.value) as Partial<PersistedEngineState>) };
  } catch {
    return INITIAL_ENGINE_STATE;
  }
}

/** Writes only when the persisted part changed, so a steady fix costs nothing. */
export function saveEngineState(state: EngineState): void {
  const value = JSON.stringify(persistedPart(state));
  if (value === lastWritten) return;

  try {
    getDb().runSync(
      'INSERT INTO appSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      KEY,
      value
    );
    lastWritten = value;
  } catch {
    // Losing one write only means the next launch re-derives from a fix.
  }
}
