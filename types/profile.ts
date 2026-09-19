/**
 * A Profile is a reusable set of device-state intentions. Zones reference
 * profiles by id; profiles are never duplicated inside a zone.
 *
 * Every setting carries an explicit "unchanged" state. Applying a profile must
 * only touch what the user actually configured — silencing the ringer should
 * never quietly take the alarm volume with it.
 */

/** Three-state switch: leave alone, force on, force off. */
export type ToggleAction = 'unchanged' | 'on' | 'off';

export type RingerMode = 'unchanged' | 'normal' | 'vibrate' | 'silent';

export type VibrationMode = 'unchanged' | 'enabled' | 'disabled';

export type DndMode = 'unchanged' | 'off' | 'priority' | 'alarms' | 'silence';

export type BrightnessAction = 'unchanged' | 'auto' | 'manual';

/** 0–100, or null to leave the stream where the user had it. */
export type VolumeSetting = number | null;

export type ProfileIcon =
  | 'home'
  | 'school'
  | 'book'
  | 'moon'
  | 'briefcase'
  | 'dumbbell'
  | 'coffee'
  | 'heart'
  | 'shield'
  | 'bell';

export const PROFILE_ICONS: ProfileIcon[] = [
  'home',
  'school',
  'book',
  'moon',
  'briefcase',
  'dumbbell',
  'coffee',
  'heart',
  'shield',
  'bell',
];

/** What SYPAU does once no zone claims the device any more. */
export type ExitRestoreStrategy =
  | 'restorePrevious'
  | 'defaultProfile'
  | 'specificProfile'
  | 'nothing';

export type ProfileConfig = {
  ringerMode: RingerMode;
  ringVolume: VolumeSetting;
  notificationVolume: VolumeSetting;
  mediaVolume: VolumeSetting;
  alarmVolume: VolumeSetting;
  systemVolume: VolumeSetting;

  vibrationMode: VibrationMode;
  dndMode: DndMode;

  wifiAction: ToggleAction;
  bluetoothAction: ToggleAction;
  mobileDataAction: ToggleAction;
  airplaneModeAction: ToggleAction;

  brightnessAction: BrightnessAction;
  /** 0–100, only meaningful when brightnessAction is 'manual'. */
  brightnessValue: number | null;
  /** Seconds, or null to leave the device timeout alone. */
  screenTimeoutSeconds: number | null;

  exitRestoreStrategy: ExitRestoreStrategy;
  exitProfileId: string | null;
};

export type Profile = {
  id: string;
  name: string;
  icon: ProfileIcon;
  isDefault: boolean;
  config: ProfileConfig;
  createdAt: number;
  updatedAt: number;
};

/** A profile that changes nothing — the base every new profile starts from. */
export const EMPTY_PROFILE_CONFIG: ProfileConfig = {
  ringerMode: 'unchanged',
  ringVolume: null,
  notificationVolume: null,
  mediaVolume: null,
  alarmVolume: null,
  systemVolume: null,

  vibrationMode: 'unchanged',
  dndMode: 'unchanged',

  wifiAction: 'unchanged',
  bluetoothAction: 'unchanged',
  mobileDataAction: 'unchanged',
  airplaneModeAction: 'unchanged',

  brightnessAction: 'unchanged',
  brightnessValue: null,
  screenTimeoutSeconds: null,

  exitRestoreStrategy: 'restorePrevious',
  exitProfileId: null,
};

/**
 * Seeded on first launch so the app is usable before the user builds anything.
 * These are real, working profiles rather than sample data — the dev seed in
 * `db/devSeed.ts` is what stays out of production.
 */
export const STARTER_PROFILES: { name: string; icon: ProfileIcon; isDefault: boolean; config: ProfileConfig }[] = [
  {
    name: 'Normal',
    icon: 'home',
    isDefault: true,
    config: {
      ...EMPTY_PROFILE_CONFIG,
      ringerMode: 'normal',
      ringVolume: 70,
      notificationVolume: 70,
      vibrationMode: 'enabled',
      dndMode: 'off',
    },
  },
  {
    name: 'Class',
    icon: 'school',
    isDefault: false,
    config: {
      ...EMPTY_PROFILE_CONFIG,
      ringerMode: 'silent',
      mediaVolume: 0,
      vibrationMode: 'disabled',
      dndMode: 'priority',
    },
  },
  {
    name: 'Study',
    icon: 'book',
    isDefault: false,
    config: {
      ...EMPTY_PROFILE_CONFIG,
      ringerMode: 'silent',
      mediaVolume: 20,
      alarmVolume: 80,
      vibrationMode: 'disabled',
      dndMode: 'priority',
    },
  },
  {
    name: 'Sleep',
    icon: 'moon',
    isDefault: false,
    config: {
      ...EMPTY_PROFILE_CONFIG,
      ringerMode: 'silent',
      notificationVolume: 0,
      mediaVolume: 0,
      // Alarms stay loud on purpose: sleeping is exactly when they matter.
      alarmVolume: 80,
      vibrationMode: 'disabled',
      dndMode: 'alarms',
    },
  },
];
