import { statusContent } from '@/core/statusNotification';
import { INITIAL_ENGINE_STATE } from '@/core/zoneEngine';
import type { StatusNotificationMode } from '@/types/settings';
import { makeProfile, makeSettings, makeZone } from './factories';

const normal = makeProfile({ id: 'normal', name: 'Normal', isDefault: true });
const sleep = makeProfile({ id: 'sleep', name: 'Sleep' });
const bedroom = makeZone({ id: 'bedroom', name: 'Bedroom', profileId: 'sleep' });
const office = makeZone({ id: 'office', name: 'Office', profileId: 'normal' });

const profiles = [normal, sleep];
const zones = [bedroom, office];

function contentFor(mode: StatusNotificationMode, activeZoneId: string | null) {
  return statusContent({
    state: { ...INITIAL_ENGINE_STATE, activeZoneId },
    settings: makeSettings({ statusNotification: mode, defaultProfileId: 'normal' }),
    zones,
    profiles,
  });
}

describe('status notification', () => {
  it('never shows when off', () => {
    expect(contentFor('off', 'bedroom')).toBeNull();
  });

  it('shows in any zone, and only in a zone, for inZone', () => {
    expect(contentFor('inZone', null)).toBeNull();
    expect(contentFor('inZone', 'office')?.title).toBe('Normal · Office');
  });

  it('shows only while a non-default profile holds the phone for profileActive', () => {
    expect(contentFor('profileActive', 'office')).toBeNull();
    expect(contentFor('profileActive', 'bedroom')?.title).toBe('Sleep · Bedroom');
  });

  it('shows outside every zone for always', () => {
    expect(contentFor('always', null)?.title).toBe('Normal · outside your zones');
  });
});
