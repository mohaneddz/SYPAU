/**
 * The native module is absent under test, so the bridge is stubbed with a
 * recorder. Engine tests assert on what SYPAU *decided* to do, which is the
 * part that carries the logic — the Kotlin side is exercised on device.
 */
jest.mock('@/core/nativeBridge', () => {
  const actual = jest.requireActual('@/core/nativeBridge');

  return {
    ...actual,
    isNativeAvailable: () => true,
    applyProfile: jest.fn(() => ({
      results: [],
      snapshot: {
        capturedAt: 1_000,
        ringerMode: 'normal',
        ringVolume: 70,
        notificationVolume: 70,
        mediaVolume: 50,
        alarmVolume: 90,
        systemVolume: 60,
        dndMode: 'off',
        brightness: 55,
        brightnessAuto: false,
        screenTimeoutSeconds: 30,
      },
    })),
    restoreSystemState: jest.fn(() => []),
    updateMonitoringNotification: jest.fn(),
  };
});

jest.mock('@/db/events', () => ({
  logEvent: jest.fn(),
  logEvents: jest.fn(),
}));

jest.mock('@/db/zones', () => ({
  markZoneEntered: jest.fn(),
  markZoneExited: jest.fn(),
}));
