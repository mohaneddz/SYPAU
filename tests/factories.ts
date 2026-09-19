import type { LatLng } from '@/engine/geo';
import { EMPTY_PROFILE_CONFIG, type Profile, type ProfileConfig } from '@/types/profile';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';
import type { Zone } from '@/types/zone';

export function makeProfile(overrides: Partial<Profile> & { id: string }): Profile {
  return {
    name: overrides.id,
    icon: 'home',
    isDefault: false,
    config: { ...EMPTY_PROFILE_CONFIG },
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<ProfileConfig>): ProfileConfig {
  return { ...EMPTY_PROFILE_CONFIG, ...overrides };
}

/** A circular zone centred on `center`. */
export function makeZone(overrides: Partial<Zone> & { id: string; center: LatLng; radiusMeters: number }): Zone {
  const { center, radiusMeters, ...rest } = overrides;

  return {
    name: overrides.id,
    icon: 'pin',
    enabled: true,
    boundaryType: 'radius',
    geometry: { type: 'circle', center, radiusMeters },
    profileId: `${overrides.id}Profile`,
    exitBehavior: 'restorePrevious',
    exitProfileId: null,
    priority: 10,
    activationDelaySeconds: 0,
    exitDelaySeconds: 0,
    createdAt: 0,
    updatedAt: 0,
    lastEnteredAt: null,
    lastExitedAt: null,
    ...rest,
  };
}

export function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
