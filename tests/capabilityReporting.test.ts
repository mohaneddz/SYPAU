import { effectsOf } from '@/components/sypau/profileEffects';
import { CONTROL_KEYS, PERMISSION_KEYS } from '@/core/nativeBridge';
import { EMPTY_PROFILE_CONFIG } from '@/types/profile';
import { makeConfig } from './factories';

/**
 * The bridge is mocked away in setup, so these exercise the parts that decide
 * *what to report* rather than the native calls themselves.
 */
describe('control coverage', () => {
  it('lists a control key for every setting a profile can express', () => {
    // A control the profile can set but the bridge doesn't know about would
    // silently never be applied or restored.
    const configKeys = Object.keys(EMPTY_PROFILE_CONFIG).filter(
      (key) => key !== 'exitRestoreStrategy' && key !== 'exitProfileId' && key !== 'brightnessValue'
    );

    expect(configKeys).toHaveLength(CONTROL_KEYS.length);
  });

  it('covers every permission the setup screen shows', () => {
    expect(PERMISSION_KEYS).toEqual(
      expect.arrayContaining([
        'locationForeground',
        'locationBackground',
        'locationServicesEnabled',
        'notifications',
        'dndAccess',
        'batteryOptimizationExempt',
        'writeSystemSettings',
      ])
    );
  });
});

describe('effectsOf', () => {
  it('reports nothing for a profile that changes nothing', () => {
    expect(effectsOf(EMPTY_PROFILE_CONFIG)).toEqual([]);
  });

  it('lists only the controls the profile sets', () => {
    const effects = effectsOf(makeConfig({ dndMode: 'priority', mediaVolume: 20 }));
    expect(effects.map((effect) => effect.key).sort()).toEqual(['dnd', 'mediaVolume']);
  });

  it('shows a muted volume as 0%, not as absent', () => {
    const effects = effectsOf(makeConfig({ mediaVolume: 0 }));
    expect(effects).toEqual([expect.objectContaining({ key: 'mediaVolume', value: '0%' })]);
  });

  it('names the Do Not Disturb mode in words rather than its raw value', () => {
    // 'alarms' means something specific to a user; the raw token doesn't.
    const effects = effectsOf(makeConfig({ dndMode: 'alarms' }));
    expect(effects[0].value).toBe('Alarms only');
  });

  it('keeps connectivity intentions visible even though Android blocks them', () => {
    const effects = effectsOf(makeConfig({ airplaneModeAction: 'on' }));
    expect(effects).toEqual([expect.objectContaining({ key: 'airplaneMode', value: 'On' })]);
  });
});
