import {
  configFromDiff,
  controlKeysReleasedBetween,
  controlKeysTouchedBy,
  diffConfigs,
  hasProblems,
  mergeSnapshots,
  summarize,
} from '@/core/profileEngine';
import type { SystemStateSnapshot } from '@/types/capability';
import { EMPTY_PROFILE_CONFIG } from '@/types/profile';
import { makeConfig } from './factories';

describe('controlKeysTouchedBy', () => {
  it('claims nothing for a profile that changes nothing', () => {
    expect(controlKeysTouchedBy(EMPTY_PROFILE_CONFIG)).toEqual([]);
  });

  it('claims only the controls the profile actually sets', () => {
    const config = makeConfig({ ringerMode: 'silent', mediaVolume: 0 });
    expect(controlKeysTouchedBy(config).sort()).toEqual(['mediaVolume', 'ringerMode']);
  });

  it('treats a zero volume as set, not as unchanged', () => {
    // 0 is falsy; null is the only "leave it alone" value.
    expect(controlKeysTouchedBy(makeConfig({ alarmVolume: 0 }))).toContain('alarmVolume');
  });

  it('leaves alarms alone when only the ringer is silenced', () => {
    const config = makeConfig({ ringerMode: 'silent', dndMode: 'priority' });
    expect(controlKeysTouchedBy(config)).not.toContain('alarmVolume');
  });
});

describe('diffConfigs', () => {
  it('returns the whole config when nothing was applied before', () => {
    const config = makeConfig({ ringerMode: 'silent' });
    expect(diffConfigs(null, config)).toEqual(config);
  });

  it('returns only what changed between two profiles', () => {
    const previous = makeConfig({ ringerMode: 'silent', mediaVolume: 20 });
    const next = makeConfig({ ringerMode: 'silent', mediaVolume: 80 });

    expect(diffConfigs(previous, next)).toEqual({ mediaVolume: 80 });
  });

  it('ignores the exit strategy, which is not a device control', () => {
    const previous = makeConfig({ exitRestoreStrategy: 'restorePrevious' });
    const next = makeConfig({ exitRestoreStrategy: 'defaultProfile' });

    expect(diffConfigs(previous, next)).toEqual({});
  });
});

describe('controlKeysReleasedBetween', () => {
  it('names the controls the outgoing profile owned and the incoming one does not', () => {
    const outgoing = makeConfig({ ringerMode: 'silent', mediaVolume: 0, dndMode: 'priority' });
    const incoming = makeConfig({ ringerMode: 'normal' });

    expect(controlKeysReleasedBetween(outgoing, incoming).sort()).toEqual(['dnd', 'mediaVolume']);
  });

  it('releases nothing when the incoming profile is a superset', () => {
    const outgoing = makeConfig({ ringerMode: 'silent' });
    const incoming = makeConfig({ ringerMode: 'normal', mediaVolume: 50 });

    expect(controlKeysReleasedBetween(outgoing, incoming)).toEqual([]);
  });
});

describe('configFromDiff', () => {
  it('layers a diff over a base config', () => {
    const base = makeConfig({ ringerMode: 'silent' });
    expect(configFromDiff(base, { mediaVolume: 30 })).toMatchObject({
      ringerMode: 'silent',
      mediaVolume: 30,
    });
  });
});

describe('summarize', () => {
  it('sorts results into the buckets the UI reports against', () => {
    const summary = summarize([
      { key: 'ringerMode', outcome: 'applied', message: null },
      { key: 'dnd', outcome: 'permissionRequired', message: 'Needs DND access.' },
      { key: 'airplaneMode', outcome: 'manualActionRequired', message: 'Android needs you.' },
      { key: 'wifi', outcome: 'unsupported', message: null },
      { key: 'brightness', outcome: 'failed', message: 'Nope.' },
      { key: 'mediaVolume', outcome: 'skipped', message: null },
    ]);

    expect(summary.applied).toHaveLength(1);
    expect(summary.needsPermission).toHaveLength(1);
    expect(summary.needsManualAction).toHaveLength(1);
    expect(summary.unsupported).toHaveLength(1);
    expect(summary.failed).toHaveLength(1);
    expect(hasProblems(summary)).toBe(true);
  });

  it('does not count an unsupported control as a problem to report', () => {
    // Unsupported is a standing fact about the device, not a failure the user
    // can act on, so it must not raise a warning on every transition.
    const summary = summarize([{ key: 'wifi', outcome: 'unsupported', message: null }]);
    expect(hasProblems(summary)).toBe(false);
  });
});

describe('mergeSnapshots', () => {
  const older: SystemStateSnapshot = {
    capturedAt: 100,
    ringerMode: 'normal',
    ringVolume: 70,
    notificationVolume: null,
    mediaVolume: 60,
    alarmVolume: null,
    systemVolume: null,
    dndMode: 'off',
    brightness: null,
    brightnessAuto: null,
    screenTimeoutSeconds: null,
  };

  const newer: SystemStateSnapshot = {
    ...older,
    capturedAt: 900,
    ringerMode: 'silent',
    ringVolume: 0,
    notificationVolume: 40,
  };

  it('keeps the oldest captured value per control', () => {
    const merged = mergeSnapshots(older, newer);

    // What's worth restoring is the state from before SYPAU touched anything.
    expect(merged?.ringerMode).toBe('normal');
    expect(merged?.ringVolume).toBe(70);
    expect(merged?.capturedAt).toBe(100);
  });

  it('takes a value from the newer snapshot when the older lacks one', () => {
    expect(mergeSnapshots(older, newer)?.notificationVolume).toBe(40);
  });

  it('passes either side through when the other is missing', () => {
    expect(mergeSnapshots(null, newer)).toBe(newer);
    expect(mergeSnapshots(older, null)).toBe(older);
  });
});
