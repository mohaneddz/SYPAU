export type TrackingMode = 'balanced' | 'highAccuracy' | 'batterySaver';

export type AppSettings = {
  automationEnabled: boolean;
  backgroundMonitoringEnabled: boolean;
  trackingMode: TrackingMode;
  defaultProfileId: string | null;
  restorePreviousState: boolean;
  /** Seconds of settling before a transition is acted on. */
  transitionDebounceSeconds: number;
  startOnBoot: boolean;

  notifyOnProfileChange: boolean;
  notifyOnZoneTransition: boolean;
  notifyOnError: boolean;

  /** Activity log retention. 0 keeps everything. */
  logRetentionDays: number;

  texturesEnabled: boolean;
  reducedMotion: boolean;

  debugEnabled: boolean;
  onboardingCompleted: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  automationEnabled: true,
  backgroundMonitoringEnabled: true,
  trackingMode: 'balanced',
  defaultProfileId: null,
  restorePreviousState: true,
  transitionDebounceSeconds: 20,
  startOnBoot: false,

  notifyOnProfileChange: true,
  notifyOnZoneTransition: true,
  notifyOnError: true,

  logRetentionDays: 30,

  texturesEnabled: true,
  reducedMotion: false,

  debugEnabled: false,
  onboardingCompleted: false,
};
