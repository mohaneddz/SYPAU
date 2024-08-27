export const SETTINGS_KEYS = {
  onboardingComplete: 'onboardingComplete',
  armed: 'armed',
  locationAccuracy: 'locationAccuracy',
  showGpsDebug: 'showGpsDebug',
  engineBackgroundState: 'engineBackgroundState',
} as const;

export type LocationAccuracyPreset = 'battery' | 'balanced' | 'precise';
