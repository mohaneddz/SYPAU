import { logEvent } from '@/db/events';
import { markZoneEntered, markZoneExited } from '@/db/zones';
import { distanceToGeometry, type LatLng } from '@/engine/geo';
import { activeZoneSet, resolveZone } from '@/engine/overlap';
import {
  applyProfile,
  restoreSystemState,
  updateMonitoringNotification,
} from '@/core/nativeBridge';
import {
  controlKeysReleasedBetween,
  controlKeysTouchedBy,
  hasProblems,
  mergeSnapshots,
  summarize,
} from '@/core/profileEngine';
import type { ControlResult, SystemStateSnapshot } from '@/types/capability';
import type { Profile } from '@/types/profile';
import type { AppSettings } from '@/types/settings';
import type { Zone, ZoneRuntimeState } from '@/types/zone';

/**
 * Hysteresis buffer, in metres. A point just outside a boundary still counts as
 * inside, so GPS jitter at the edge doesn't flap the profile on and off.
 */
const BOUNDARY_BUFFER_METERS = 25;

export type EngineState = {
  activeZoneId: string | null;
  /** Every zone currently containing the user, highest priority first. */
  matchedZoneIds: string[];
  zoneStates: ZoneRuntimeState[];
  /** Device state from before SYPAU changed anything this session. */
  snapshot: SystemStateSnapshot | null;
  /** Controls SYPAU currently owns and is responsible for handing back. */
  ownedKeys: string[];
  activeSince: number | null;
  lastResults: ControlResult[];
};

export const INITIAL_ENGINE_STATE: EngineState = {
  activeZoneId: null,
  matchedZoneIds: [],
  zoneStates: [],
  snapshot: null,
  ownedKeys: [],
  activeSince: null,
  lastResults: [],
};

export type ResolveInput = {
  position: LatLng;
  zones: Zone[];
  profiles: Profile[];
  settings: AppSettings;
  state: EngineState;
  /** Injected so dwell logic is testable without waiting on real time. */
  now?: number;
  /** Zones seen inside continuously since this timestamp, for dwell gating. */
  dwellSince?: Record<string, number>;
};

export type ResolveOutcome = {
  state: EngineState;
  /** Zones that newly qualify, after their activation delay. */
  entered: Zone[];
  exited: Zone[];
  /** Null when no zone owns the device. */
  activeZone: Zone | null;
  profileChanged: boolean;
  dwellSince: Record<string, number>;
};

/**
 * Work out which zone owns the device, given a position.
 *
 * Pure: it computes the transition but performs none of it. `applyTransition`
 * does the device work, so this half can be tested exhaustively without a
 * device attached.
 */
export function resolveActiveZone(input: ResolveInput): ResolveOutcome {
  const { position, zones, settings, state } = input;
  const now = input.now ?? Date.now();
  const previousDwell = input.dwellSince ?? {};

  const enabledZones = zones.filter((zone) => zone.enabled);

  const zoneStates: ZoneRuntimeState[] = enabledZones.map((zone) => {
    const distance = distanceToGeometry(position, zone.geometry);
    return {
      zoneId: zone.id,
      isInside: distance <= BOUNDARY_BUFFER_METERS,
      distanceMeters: distance,
      isDwelling: false,
    };
  });

  const insideNow = activeZoneSet(position, enabledZones, BOUNDARY_BUFFER_METERS);

  // Track how long each zone has been continuously inside, so a drive-past
  // never trips a zone that asked for a dwell.
  const dwellSince: Record<string, number> = {};
  for (const zone of insideNow) {
    dwellSince[zone.id] = previousDwell[zone.id] ?? now;
  }

  const qualified = insideNow.filter((zone) => {
    const requiredMs = zone.activationDelaySeconds * 1000;
    if (requiredMs <= 0) return true;
    return now - (dwellSince[zone.id] ?? now) >= requiredMs;
  });

  for (const zoneState of zoneStates) {
    zoneState.isDwelling =
      zoneState.isInside && !qualified.some((zone) => zone.id === zoneState.zoneId);
  }

  const sortedMatches = [...qualified].sort((a, b) => b.priority - a.priority);
  const winner = settings.automationEnabled ? resolveZone(qualified) : null;

  const previousActiveId = state.activeZoneId;
  const previouslyMatched = new Set(state.matchedZoneIds);
  const nowMatched = new Set(qualified.map((zone) => zone.id));

  const entered = qualified.filter((zone) => !previouslyMatched.has(zone.id));
  const exited = enabledZones.filter(
    (zone) => previouslyMatched.has(zone.id) && !nowMatched.has(zone.id)
  );

  return {
    state: {
      ...state,
      activeZoneId: winner?.id ?? null,
      matchedZoneIds: sortedMatches.map((zone) => zone.id),
      zoneStates,
    },
    entered,
    exited,
    activeZone: winner,
    profileChanged: (winner?.id ?? null) !== previousActiveId,
    dwellSince,
  };
}

export type TransitionInput = {
  outcome: ResolveOutcome;
  previousActiveZone: Zone | null;
  profiles: Profile[];
  settings: AppSettings;
  state: EngineState;
};

/**
 * Carry out the device-state change for a transition and write the log.
 *
 * The ordering matters when zones nest: the incoming profile is applied first,
 * then only the controls the outgoing profile owned *and the incoming one
 * doesn't* are handed back. Leaving a bedroom while still inside the house
 * therefore lands on the house profile rather than the pre-bedroom device
 * state.
 */
export function applyTransition(input: TransitionInput): EngineState {
  const { outcome, previousActiveZone, profiles, settings, state } = input;
  const { activeZone } = outcome;

  const profileFor = (id: string | null | undefined) =>
    id ? (profiles.find((p) => p.id === id) ?? null) : null;

  for (const zone of outcome.entered) {
    markZoneEntered(zone.id, Date.now());
    if (settings.notifyOnZoneTransition) {
      logEvent({
        category: 'zone',
        title: `Entered ${zone.name}`,
        description: describeBoundary(zone),
        zoneId: zone.id,
        severity: 'info',
      });
    }
  }

  for (const zone of outcome.exited) {
    markZoneExited(zone.id, Date.now());
    if (settings.notifyOnZoneTransition) {
      logEvent({
        category: 'zone',
        title: `Exited ${zone.name}`,
        description: describeBoundary(zone),
        zoneId: zone.id,
        severity: 'info',
      });
    }
  }

  if (!outcome.profileChanged) return outcome.state;

  const previousProfile = profileFor(previousActiveZone?.profileId);

  // A zone took over.
  if (activeZone) {
    const profile = profileFor(activeZone.profileId);
    if (!profile) {
      logEvent({
        category: 'error',
        title: 'Profile missing',
        description: `${activeZone.name} points at a profile that no longer exists.`,
        zoneId: activeZone.id,
        severity: 'error',
      });
      return outcome.state;
    }

    const { results, snapshot } = applyProfile(profile.config);
    const summary = summarize(results);

    // Keep the oldest capture so a nested zone still restores to the state
    // from before SYPAU touched anything.
    const heldSnapshot = mergeSnapshots(state.snapshot, snapshot);

    // Hand back only what the outgoing profile owned and this one doesn't.
    if (previousProfile && heldSnapshot) {
      const released = controlKeysReleasedBetween(previousProfile.config, profile.config);
      if (released.length > 0) restoreSystemState(heldSnapshot, released);
    }

    logEvent({
      category: 'profile',
      title: `${profile.name} activated`,
      description: activeZone.name,
      zoneId: activeZone.id,
      profileId: profile.id,
      severity: hasProblems(summary) ? 'warning' : 'success',
      metadata: { results },
    });

    logApplyProblems(summary, settings, activeZone.id, profile.id);
    updateMonitoringNotification(activeZone.name);

    return {
      ...outcome.state,
      snapshot: heldSnapshot,
      ownedKeys: controlKeysTouchedBy(profile.config),
      activeSince: Date.now(),
      lastResults: results,
    };
  }

  // No zone owns the device any more — release according to the exit rule.
  return releaseToFallback({
    previousActiveZone,
    previousProfile,
    profiles,
    settings,
    state: outcome.state,
    heldSnapshot: state.snapshot,
    ownedKeys: state.ownedKeys,
  });
}

function releaseToFallback(args: {
  previousActiveZone: Zone | null;
  previousProfile: Profile | null;
  profiles: Profile[];
  settings: AppSettings;
  state: EngineState;
  heldSnapshot: SystemStateSnapshot | null;
  ownedKeys: string[];
}): EngineState {
  const { previousActiveZone, previousProfile, profiles, settings, state, heldSnapshot, ownedKeys } =
    args;

  const behavior = previousActiveZone?.exitBehavior ?? 'restorePrevious';

  const fallbackProfile = (() => {
    if (behavior === 'specificProfile') {
      return profiles.find((p) => p.id === previousActiveZone?.exitProfileId) ?? null;
    }
    if (behavior === 'defaultProfile') {
      return (
        profiles.find((p) => p.id === settings.defaultProfileId) ??
        profiles.find((p) => p.isDefault) ??
        null
      );
    }
    return null;
  })();

  if (behavior === 'nothing') {
    logEvent({
      category: 'profile',
      title: 'Zone released',
      description: 'Device state left as it was, per this zone’s exit rule.',
      zoneId: previousActiveZone?.id ?? null,
      severity: 'info',
    });
    return { ...state, ownedKeys: [], activeSince: null };
  }

  if (fallbackProfile) {
    const { results } = applyProfile(fallbackProfile.config);
    logEvent({
      category: 'profile',
      title: `${fallbackProfile.name} activated`,
      description: 'Fallback profile after leaving your zone.',
      profileId: fallbackProfile.id,
      severity: 'success',
      metadata: { results },
    });
    return {
      ...state,
      ownedKeys: controlKeysTouchedBy(fallbackProfile.config),
      activeSince: Date.now(),
      lastResults: results,
      // Original capture is kept: the device still isn't back to how we found it.
      snapshot: heldSnapshot,
    };
  }

  // restorePrevious: give back exactly what SYPAU took, and nothing else.
  if (heldSnapshot && ownedKeys.length > 0) {
    const results = restoreSystemState(
      heldSnapshot,
      ownedKeys as Parameters<typeof restoreSystemState>[1]
    );
    logEvent({
      category: 'profile',
      title: 'Previous state restored',
      description: previousProfile ? `After ${previousProfile.name}.` : null,
      zoneId: previousActiveZone?.id ?? null,
      severity: 'success',
      metadata: { results },
    });
  }

  updateMonitoringNotification(null);

  return { ...state, snapshot: null, ownedKeys: [], activeSince: null };
}

function logApplyProblems(
  summary: ReturnType<typeof summarize>,
  settings: AppSettings,
  zoneId: string,
  profileId: string
): void {
  if (!settings.notifyOnError) return;

  for (const result of summary.needsPermission) {
    logEvent({
      category: 'error',
      title: `${controlLabel(result.key)} needs permission`,
      description: result.message,
      zoneId,
      profileId,
      severity: 'warning',
    });
  }

  for (const result of summary.needsManualAction) {
    logEvent({
      category: 'system',
      title: `${controlLabel(result.key)} needs you`,
      description: result.message,
      zoneId,
      profileId,
      severity: 'warning',
    });
  }

  for (const result of summary.failed) {
    logEvent({
      category: 'error',
      title: `${controlLabel(result.key)} failed`,
      description: result.message,
      zoneId,
      profileId,
      severity: 'error',
    });
  }
}

const CONTROL_LABELS: Record<string, string> = {
  ringerMode: 'Ringer',
  ringVolume: 'Ring volume',
  notificationVolume: 'Notification volume',
  mediaVolume: 'Media volume',
  alarmVolume: 'Alarm volume',
  systemVolume: 'System volume',
  vibration: 'Vibration',
  dnd: 'Do Not Disturb',
  wifi: 'Wi‑Fi',
  bluetooth: 'Bluetooth',
  mobileData: 'Mobile data',
  airplaneMode: 'Airplane mode',
  brightness: 'Brightness',
  screenTimeout: 'Screen timeout',
};

export function controlLabel(key: string): string {
  return CONTROL_LABELS[key] ?? key;
}

function describeBoundary(zone: Zone): string {
  if (zone.geometry.type === 'circle') {
    return `${Math.round(zone.geometry.radiusMeters)} m radius`;
  }
  return `${zone.geometry.points.length}-point boundary`;
}
