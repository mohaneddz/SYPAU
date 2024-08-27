import type { EventType, FieldEvent } from '@/types/event';
import type { Fold } from '@/types/fold';

const DRIFT_WINDOW_MS = 20_000;
const DRIFT_DISTINCT_THRESHOLD = 3;
const HOLDING_STABLE_MS = 8_000;

type HistoryEntry = { ts: number; foldId: string | null };

export type EngineState = {
  confirmedFoldId: string | null;
  pendingFoldId: string | null;
  pendingSince: number | null;
  history: HistoryEntry[];
  holding: boolean;
  holdingSince: number | null;
  /** Single-level restore stack per plan.md §3.4 — overlap resolution already yields one active fold. */
  activeOverride: { foldId: string; profileId: string } | null;
};

export function createInitialEngineState(): EngineState {
  return {
    confirmedFoldId: null,
    pendingFoldId: null,
    pendingSince: null,
    history: [],
    holding: false,
    holdingSince: null,
    activeOverride: null,
  };
}

type PendingEvent = Omit<FieldEvent, 'id'>;

function makeEvent(now: number, type: EventType, foldId: string | null, payload: Record<string, unknown> = {}): PendingEvent {
  return { ts: now, type, foldId, payload };
}

export function tickFieldEngine(
  state: EngineState,
  now: number,
  rawResolvedFoldId: string | null,
  folds: Fold[]
): { state: EngineState; events: PendingEvent[] } {
  const history = [...state.history, { ts: now, foldId: rawResolvedFoldId }].filter(
    (entry) => now - entry.ts <= DRIFT_WINDOW_MS
  );
  const events: PendingEvent[] = [];

  const distinctRecent = new Set(history.map((h) => h.foldId)).size;

  // Entering (or continuing) a drift-holding episode.
  if (!state.holding && distinctRecent >= DRIFT_DISTINCT_THRESHOLD) {
    events.push(makeEvent(now, 'HOLDING', state.confirmedFoldId, { reason: 'gps_drift', distinctRecent }));
    return {
      state: {
        ...state,
        history,
        holding: true,
        holdingSince: now,
        pendingFoldId: null,
        pendingSince: null,
      },
      events,
    };
  }

  if (state.holding) {
    const stableWindow = history.filter((entry) => now - entry.ts <= HOLDING_STABLE_MS);
    const isStable = stableWindow.length > 0 && stableWindow.every((entry) => entry.foldId === rawResolvedFoldId);
    const longEnough = now - (state.holdingSince ?? now) >= HOLDING_STABLE_MS;

    if (isStable && longEnough) {
      // Resume normal evaluation from the now-stable raw value.
      return tickFieldEngine(
        { ...state, history, holding: false, holdingSince: null, pendingSince: now, pendingFoldId: rawResolvedFoldId },
        now,
        rawResolvedFoldId,
        folds
      );
    }
    return { state: { ...state, history }, events };
  }

  // Already stable at this resolution — nothing to do.
  if (rawResolvedFoldId === state.confirmedFoldId) {
    return { state: { ...state, history, pendingFoldId: null, pendingSince: null }, events };
  }

  const pendingSince = state.pendingFoldId === rawResolvedFoldId && state.pendingSince ? state.pendingSince : now;
  const enteringFold = rawResolvedFoldId ? folds.find((f) => f.id === rawResolvedFoldId) : null;
  const exitingFold = state.confirmedFoldId ? folds.find((f) => f.id === state.confirmedFoldId) : null;
  const requiredDwell = rawResolvedFoldId ? (enteringFold?.dwellEnterMs ?? 0) : (exitingFold?.dwellExitMs ?? 0);
  const elapsed = now - pendingSince;

  if (elapsed < requiredDwell) {
    return {
      state: { ...state, history, pendingFoldId: rawResolvedFoldId, pendingSince },
      events,
    };
  }

  // Dwell satisfied — commit the transition.
  const prev = state.confirmedFoldId;
  const next = rawResolvedFoldId;

  if (prev === null && next !== null) {
    events.push(makeEvent(now, 'ENTER', next));
  } else if (prev !== null && next === null) {
    events.push(makeEvent(now, 'EXIT', prev));
  } else if (prev !== null && next !== null) {
    events.push(makeEvent(now, 'RESOLVE_CHANGE', next, { from: prev, to: next }));
  }

  const nextFold = next ? folds.find((f) => f.id === next) : null;
  const activeOverride = nextFold ? { foldId: nextFold.id, profileId: nextFold.profileId } : null;

  return {
    state: {
      ...state,
      history,
      confirmedFoldId: next,
      pendingFoldId: null,
      pendingSince: null,
      activeOverride,
    },
    events,
  };
}
