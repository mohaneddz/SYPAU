export type PresetKey =
  | 'school'
  | 'studying'
  | 'sleeping'
  | 'awake'
  | 'tired'
  | 'praying'
  | 'silent';

export type AlarmIntensity = 'normal' | 'gentle' | 'silent';

export type ProfileConfig = {
  alarmIntensity: AlarmIntensity;
  vibrate: boolean;
  /** Require a deliberate tap to dismiss instead of a swipe/loud ring. */
  gentleConfirm: boolean;
};

export type Profile = {
  id: string;
  name: string;
  presetKey: PresetKey | null;
  config: ProfileConfig;
  createdAt: number;
  updatedAt: number;
};

export const PRESET_PROFILES: Record<PresetKey, { name: string; config: ProfileConfig }> = {
  school: { name: 'School', config: { alarmIntensity: 'gentle', vibrate: true, gentleConfirm: true } },
  studying: { name: 'Studying', config: { alarmIntensity: 'silent', vibrate: true, gentleConfirm: false } },
  sleeping: { name: 'Sleeping', config: { alarmIntensity: 'normal', vibrate: true, gentleConfirm: false } },
  awake: { name: 'Awake', config: { alarmIntensity: 'normal', vibrate: false, gentleConfirm: false } },
  tired: { name: 'Tired', config: { alarmIntensity: 'gentle', vibrate: true, gentleConfirm: false } },
  praying: { name: 'Praying', config: { alarmIntensity: 'silent', vibrate: true, gentleConfirm: true } },
  silent: { name: 'Silent', config: { alarmIntensity: 'silent', vibrate: false, gentleConfirm: false } },
};
