/**
 * What Android will actually let SYPAU do on this device, right now.
 *
 * Every system control reports one of these. The UI never claims an action
 * succeeded when the platform refused it — an unsupported control is shown as
 * unsupported, and a gated one sends the user to the right settings screen.
 */
export type CapabilityStatus =
  | 'availableDirectly'
  | 'requiresPermission'
  | 'requiresSettingsPanel'
  | 'unsupported';

/** The system controls a profile can express an intention about. */
export type ControlKey =
  | 'ringerMode'
  | 'ringVolume'
  | 'notificationVolume'
  | 'mediaVolume'
  | 'alarmVolume'
  | 'systemVolume'
  | 'vibration'
  | 'dnd'
  | 'wifi'
  | 'bluetooth'
  | 'mobileData'
  | 'airplaneMode'
  | 'brightness'
  | 'screenTimeout';

export type Capability = {
  key: ControlKey;
  status: CapabilityStatus;
  /** User-facing reason, supplied by the native layer. Never raw API names. */
  detail: string;
};

export type CapabilityMap = Record<ControlKey, Capability>;

/** Outcome of applying one control while a profile is being applied. */
export type ApplyOutcome =
  | 'applied'
  | 'skipped'
  | 'permissionRequired'
  | 'manualActionRequired'
  | 'unsupported'
  | 'failed';

export type ControlResult = {
  key: ControlKey;
  outcome: ApplyOutcome;
  message: string | null;
};

export type ApplyProfileResult = {
  profileId: string;
  results: ControlResult[];
  /** Device state captured before anything changed, for restore. */
  snapshot: SystemStateSnapshot;
};

/**
 * The device state SYPAU captured before it started changing things. Only the
 * values SYPAU actually wrote get restored, so a change the user made by hand
 * while a profile was active isn't stomped on the way out.
 */
export type SystemStateSnapshot = {
  capturedAt: number;
  ringerMode: 'normal' | 'vibrate' | 'silent' | null;
  ringVolume: number | null;
  notificationVolume: number | null;
  mediaVolume: number | null;
  alarmVolume: number | null;
  systemVolume: number | null;
  dndMode: 'off' | 'priority' | 'alarms' | 'silence' | null;
  brightness: number | null;
  brightnessAuto: boolean | null;
  screenTimeoutSeconds: number | null;
};

export type PermissionKey =
  | 'locationForeground'
  | 'locationBackground'
  | 'locationServicesEnabled'
  | 'notifications'
  | 'dndAccess'
  | 'batteryOptimizationExempt'
  | 'writeSystemSettings';

export type PermissionState = {
  key: PermissionKey;
  granted: boolean;
  /** False when the OS will no longer show a prompt and only Settings works. */
  canRequestInApp: boolean;
};

export type MonitoringStatus = {
  running: boolean;
  /** Geofences registered with the platform, rather than polled by us. */
  registeredGeofences: number;
  trackingMode: 'balanced' | 'highAccuracy' | 'batterySaver';
  startedAt: number | null;
  updateCount: number;
  lastHeartbeatAt: number | null;
};
