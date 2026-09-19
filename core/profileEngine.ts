import type { ControlKey, ControlResult, SystemStateSnapshot } from '@/types/capability';
import type { ProfileConfig } from '@/types/profile';

/**
 * Which controls a profile actually writes.
 *
 * This is the basis of state ownership: SYPAU restores only what it changed.
 * A user who nudges the media volume by hand while a zone is active keeps that
 * change on the way out, because media was never SYPAU's to give back unless
 * the profile set it.
 */
export function controlKeysTouchedBy(config: ProfileConfig): ControlKey[] {
  const keys: ControlKey[] = [];

  if (config.ringerMode !== 'unchanged') keys.push('ringerMode');
  if (config.ringVolume !== null) keys.push('ringVolume');
  if (config.notificationVolume !== null) keys.push('notificationVolume');
  if (config.mediaVolume !== null) keys.push('mediaVolume');
  if (config.alarmVolume !== null) keys.push('alarmVolume');
  if (config.systemVolume !== null) keys.push('systemVolume');
  if (config.vibrationMode !== 'unchanged') keys.push('vibration');
  if (config.dndMode !== 'unchanged') keys.push('dnd');
  if (config.wifiAction !== 'unchanged') keys.push('wifi');
  if (config.bluetoothAction !== 'unchanged') keys.push('bluetooth');
  if (config.mobileDataAction !== 'unchanged') keys.push('mobileData');
  if (config.airplaneModeAction !== 'unchanged') keys.push('airplaneMode');
  if (config.brightnessAction !== 'unchanged') keys.push('brightness');
  if (config.screenTimeoutSeconds !== null) keys.push('screenTimeout');

  return keys;
}

/**
 * The subset of `next` that differs from what `previous` already set.
 *
 * Re-writing a value the device is already at is a wasted system call and, for
 * the audio streams, a visible volume toast. Moving between two profiles that
 * share a setting should leave that setting alone.
 */
export function diffConfigs(
  previous: ProfileConfig | null,
  next: ProfileConfig
): Partial<ProfileConfig> {
  if (!previous) return { ...next };

  const diff: Partial<ProfileConfig> = {};
  const keys = Object.keys(next) as (keyof ProfileConfig)[];

  for (const key of keys) {
    // Exit strategy isn't a device control; it's read when the zone releases.
    if (key === 'exitRestoreStrategy' || key === 'exitProfileId') continue;
    if (previous[key] !== next[key]) {
      // A narrowing assignment per key would need a cast either way; the
      // shapes are identical, so copy the value across as-is.
      (diff as Record<string, unknown>)[key] = next[key];
    }
  }

  return diff;
}

/**
 * Controls that `previous` set and `next` doesn't, i.e. the ones that should be
 * handed back to the snapshot when moving between profiles.
 */
export function controlKeysReleasedBetween(
  previous: ProfileConfig,
  next: ProfileConfig
): ControlKey[] {
  const nextKeys = new Set(controlKeysTouchedBy(next));
  return controlKeysTouchedBy(previous).filter((key) => !nextKeys.has(key));
}

/** A config carrying only the keys in `diff`, with the rest left unchanged. */
export function configFromDiff(base: ProfileConfig, diff: Partial<ProfileConfig>): ProfileConfig {
  return { ...base, ...diff };
}

export type ApplySummary = {
  applied: ControlResult[];
  needsPermission: ControlResult[];
  needsManualAction: ControlResult[];
  unsupported: ControlResult[];
  failed: ControlResult[];
};

/** Group a raw result list into the buckets the UI reports against. */
export function summarize(results: ControlResult[]): ApplySummary {
  const summary: ApplySummary = {
    applied: [],
    needsPermission: [],
    needsManualAction: [],
    unsupported: [],
    failed: [],
  };

  for (const result of results) {
    switch (result.outcome) {
      case 'applied':
        summary.applied.push(result);
        break;
      case 'permissionRequired':
        summary.needsPermission.push(result);
        break;
      case 'manualActionRequired':
        summary.needsManualAction.push(result);
        break;
      case 'unsupported':
        summary.unsupported.push(result);
        break;
      case 'failed':
        summary.failed.push(result);
        break;
      case 'skipped':
        break;
    }
  }

  return summary;
}

export function hasProblems(summary: ApplySummary): boolean {
  return (
    summary.needsPermission.length > 0 ||
    summary.needsManualAction.length > 0 ||
    summary.failed.length > 0
  );
}

/**
 * Merge a newer snapshot into the one we're holding, keeping the *oldest*
 * captured value per control.
 *
 * When zones nest, the value worth restoring is what the device looked like
 * before SYPAU touched anything — not what the outer zone happened to leave
 * behind on the way in.
 */
export function mergeSnapshots(
  held: SystemStateSnapshot | null,
  incoming: SystemStateSnapshot | null
): SystemStateSnapshot | null {
  if (!held) return incoming;
  if (!incoming) return held;

  const merged = { ...incoming } as SystemStateSnapshot;
  for (const key of Object.keys(held) as (keyof SystemStateSnapshot)[]) {
    if (key === 'capturedAt') continue;
    if (held[key] !== null && held[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = held[key];
    }
  }
  merged.capturedAt = held.capturedAt;

  return merged;
}
