import { applyTransition, INITIAL_ENGINE_STATE, resolveActiveZone } from '@/core/zoneEngine';
import { applyProfile, restoreSystemState } from '@/core/nativeBridge';
import type { LatLng } from '@/engine/geo';
import { makeConfig, makeProfile, makeSettings, makeZone } from './factories';

const HOUSE: LatLng = { latitude: 36.7538, longitude: 3.0588 };
// ~100 m north of the house centre: well inside the house, and far enough
// from it that the house centre falls outside the bedroom's 30 m + buffer.
const BEDROOM: LatLng = { latitude: 36.7547, longitude: 3.0588 };
// ~900 m away: outside everything.
const AWAY: LatLng = { latitude: 36.7619, longitude: 3.0588 };

const homeProfile = makeProfile({
  id: 'homeProfile',
  name: 'Home',
  config: makeConfig({ ringerMode: 'normal', ringVolume: 70, mediaVolume: 60 }),
});

const bedroomProfile = makeProfile({
  id: 'bedroomProfile',
  name: 'Sleep',
  config: makeConfig({ ringerMode: 'silent', dndMode: 'alarms', alarmVolume: 80 }),
});

const defaultProfile = makeProfile({
  id: 'defaultProfile',
  name: 'Normal',
  isDefault: true,
  config: makeConfig({ ringerMode: 'normal' }),
});

const profiles = [homeProfile, bedroomProfile, defaultProfile];

const houseZone = makeZone({
  id: 'house',
  name: 'Home',
  center: HOUSE,
  radiusMeters: 150,
  profileId: 'homeProfile',
  priority: 10,
});

const bedroomZone = makeZone({
  id: 'bedroom',
  name: 'Bedroom',
  center: BEDROOM,
  radiusMeters: 30,
  profileId: 'bedroomProfile',
  priority: 20,
});

const zones = [houseZone, bedroomZone];
const settings = makeSettings();

beforeEach(() => {
  jest.clearAllMocks();
});

function step(position: LatLng, state = INITIAL_ENGINE_STATE, previousActiveZone: typeof houseZone | null = null) {
  const outcome = resolveActiveZone({ position, zones, profiles, settings, state });
  const nextState = applyTransition({
    outcome,
    previousActiveZone,
    profiles,
    settings,
    state,
  });
  return { outcome, state: nextState };
}

describe('zone priority', () => {
  it('picks the higher-priority zone when zones overlap', () => {
    const { outcome } = step(BEDROOM);

    expect(outcome.activeZone?.id).toBe('bedroom');
    expect(outcome.state.matchedZoneIds).toEqual(['bedroom', 'house']);
  });

  it('falls back to the lower-priority zone that still contains the user', () => {
    const inBedroom = step(BEDROOM);
    expect(inBedroom.outcome.activeZone?.id).toBe('bedroom');

    const backToHouse = step(HOUSE, inBedroom.state, bedroomZone);

    // The house is still active, so this is a handover, not a restore.
    expect(backToHouse.outcome.activeZone?.id).toBe('house');
    expect(backToHouse.outcome.profileChanged).toBe(true);
  });

  it('breaks a priority tie toward the smaller zone', () => {
    const tied = [
      makeZone({ id: 'big', center: HOUSE, radiusMeters: 300, priority: 10, profileId: 'homeProfile' }),
      makeZone({ id: 'small', center: HOUSE, radiusMeters: 60, priority: 10, profileId: 'bedroomProfile' }),
    ];

    const outcome = resolveActiveZone({
      position: HOUSE,
      zones: tied,
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
    });

    expect(outcome.activeZone?.id).toBe('small');
  });

  it('ignores disabled zones', () => {
    const outcome = resolveActiveZone({
      position: BEDROOM,
      zones: [houseZone, { ...bedroomZone, enabled: false }],
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
    });

    expect(outcome.activeZone?.id).toBe('house');
  });

  it('activates nothing while automation is switched off', () => {
    const outcome = resolveActiveZone({
      position: BEDROOM,
      zones,
      profiles,
      settings: makeSettings({ automationEnabled: false }),
      state: INITIAL_ENGINE_STATE,
    });

    expect(outcome.activeZone).toBeNull();
  });
});

describe('the nested-zone scenario', () => {
  it('runs home to bedroom and back out to the fallback', () => {
    // Enter the house.
    const inHouse = step(HOUSE);
    expect(inHouse.outcome.activeZone?.id).toBe('house');

    // Walk into the bedroom: higher priority takes over.
    const inBedroom = step(BEDROOM, inHouse.state, houseZone);
    expect(inBedroom.outcome.activeZone?.id).toBe('bedroom');

    // Leave the bedroom, still inside the house: the house profile returns
    // rather than the pre-bedroom device state.
    const backToHouse = step(HOUSE, inBedroom.state, bedroomZone);
    expect(backToHouse.outcome.activeZone?.id).toBe('house');
    expect(backToHouse.state.ownedKeys).toEqual(
      expect.arrayContaining(['ringerMode', 'ringVolume', 'mediaVolume'])
    );

    // Leave the house entirely: nothing owns the device.
    const away = step(AWAY, backToHouse.state, houseZone);
    expect(away.outcome.activeZone).toBeNull();
    expect(away.state.ownedKeys).toEqual([]);
    expect(away.state.activeSince).toBeNull();
    expect(restoreSystemState).toHaveBeenCalled();
  });

  it('keeps the original snapshot across a nested handover', () => {
    const inHouse = step(HOUSE);
    const capturedAt = inHouse.state.snapshot?.capturedAt;

    const inBedroom = step(BEDROOM, inHouse.state, houseZone);

    // The value worth restoring is from before SYPAU touched anything.
    expect(inBedroom.state.snapshot?.capturedAt).toBe(capturedAt);
  });
});

describe('exit behaviour', () => {
  it('activates the default profile when the zone asks for it', () => {
    const zone = { ...houseZone, exitBehavior: 'defaultProfile' as const };
    const inHouse = step(HOUSE);

    const away = applyTransition({
      outcome: resolveActiveZone({
        position: AWAY,
        zones: [zone],
        profiles,
        settings,
        state: inHouse.state,
      }),
      previousActiveZone: zone,
      profiles,
      settings,
      state: inHouse.state,
    });

    expect(applyProfile).toHaveBeenLastCalledWith(defaultProfile.config);
    expect(away.ownedKeys).toContain('ringerMode');
  });

  it('leaves the device alone when the zone says do nothing', () => {
    const zone = { ...houseZone, exitBehavior: 'nothing' as const };
    const inHouse = step(HOUSE);
    jest.clearAllMocks();

    applyTransition({
      outcome: resolveActiveZone({
        position: AWAY,
        zones: [zone],
        profiles,
        settings,
        state: inHouse.state,
      }),
      previousActiveZone: zone,
      profiles,
      settings,
      state: inHouse.state,
    });

    expect(restoreSystemState).not.toHaveBeenCalled();
    expect(applyProfile).not.toHaveBeenCalled();
  });
});

describe('dwell gating', () => {
  const slowZone = makeZone({
    id: 'slow',
    center: HOUSE,
    radiusMeters: 150,
    profileId: 'homeProfile',
    activationDelaySeconds: 20,
  });

  it('holds a zone inactive until its activation delay has passed', () => {
    const first = resolveActiveZone({
      position: HOUSE,
      zones: [slowZone],
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
      now: 1_000,
    });

    expect(first.activeZone).toBeNull();
    expect(first.state.zoneStates[0].isDwelling).toBe(true);

    const later = resolveActiveZone({
      position: HOUSE,
      zones: [slowZone],
      profiles,
      settings,
      state: first.state,
      now: 1_000 + 21_000,
      dwellSince: first.dwellSince,
    });

    expect(later.activeZone?.id).toBe('slow');
    expect(later.state.zoneStates[0].isDwelling).toBe(false);
  });

  it('restarts the dwell clock after stepping outside', () => {
    const inside = resolveActiveZone({
      position: HOUSE,
      zones: [slowZone],
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
      now: 1_000,
    });

    const outside = resolveActiveZone({
      position: AWAY,
      zones: [slowZone],
      profiles,
      settings,
      state: inside.state,
      now: 5_000,
      dwellSince: inside.dwellSince,
    });

    expect(outside.dwellSince).toEqual({});

    const backInside = resolveActiveZone({
      position: HOUSE,
      zones: [slowZone],
      profiles,
      settings,
      state: outside.state,
      now: 10_000,
      dwellSince: outside.dwellSince,
    });

    // The earlier time inside doesn't count toward the delay.
    expect(backInside.activeZone).toBeNull();
  });
});

describe('boundary jitter', () => {
  it('keeps a zone active for a fix just outside the boundary', () => {
    // ~160 m out on a 150 m radius: within the hysteresis buffer.
    const justOutside: LatLng = { latitude: 36.75524, longitude: 3.0588 };

    const outcome = resolveActiveZone({
      position: justOutside,
      zones: [houseZone],
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
    });

    expect(outcome.activeZone?.id).toBe('house');
  });
});

describe('missing profile', () => {
  it('does not activate a zone whose profile was deleted', () => {
    const orphan = makeZone({
      id: 'orphan',
      center: HOUSE,
      radiusMeters: 150,
      profileId: 'deletedProfile',
    });

    const outcome = resolveActiveZone({
      position: HOUSE,
      zones: [orphan],
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
    });

    const next = applyTransition({
      outcome,
      previousActiveZone: null,
      profiles,
      settings,
      state: INITIAL_ENGINE_STATE,
    });

    expect(applyProfile).not.toHaveBeenCalled();
    expect(next.ownedKeys).toEqual([]);
  });
});
