import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { startZoneMonitoring, stopZoneMonitoring, syncGeofences } from '@/core/monitoring';
import { subscribeToSystemEvents } from '@/core/nativeBridge';
import { applyTransition, resolveActiveZone } from '@/core/zoneEngine';
import { getZone } from '@/db/zones';
import { useActivityStore } from '@/state/useActivityStore';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import { seedBackgroundState } from '@/tasks/locationTask';

/**
 * Drives the automation while the UI is open.
 *
 * The background task owns the same engine when the app isn't running; this
 * hook exists so the visible state stays live and transitions are reflected
 * immediately rather than on next launch.
 */
export function useSypauEngine(): { refreshLocation: () => Promise<void> } {
  const dwellRef = useRef<Record<string, number>>({});

  const evaluate = useCallback(
    (point: { latitude: number; longitude: number }) => {
      const settings = useSettingsStore.getState().settings;
      const zones = useZoneStore.getState().zones;
      const profiles = useProfileStore.getState().profiles;
      const engineState = useEngineStore.getState().engine;

      const previousActiveZone = engineState.activeZoneId
        ? getZone(engineState.activeZoneId)
        : null;

      const outcome = resolveActiveZone({
        position: point,
        zones,
        profiles,
        settings,
        state: engineState,
        dwellSince: dwellRef.current,
      });

      dwellRef.current = outcome.dwellSince;

      const nextState = applyTransition({
        outcome,
        previousActiveZone,
        profiles,
        settings,
        state: engineState,
      });

      useEngineStore.getState().setEngine(nextState);
      // Handed over so a background wake-up continues from what the UI knew
      // rather than rebuilding ownership from nothing.
      seedBackgroundState(nextState);

      if (outcome.profileChanged) {
        useActivityStore.getState().load();
      }
    },
    []
  );

  const refreshLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      useEngineStore.getState().setFix({
        point,
        accuracyMeters: position.coords.accuracy,
        speedMetersPerSecond: position.coords.speed,
        headingDegrees: position.coords.heading,
        timestamp: position.timestamp,
        provider: position.mocked ? 'mock' : 'fused',
      });

      evaluate(point);
    } catch (error) {
      useEngineStore.getState().pushDiagnostic({
        message: 'Couldn’t get a location fix',
        detail: error instanceof Error ? error.message : null,
        severity: 'warning',
      });
    }
  }, [evaluate]);

  // Foreground position watch. Separate from the background task so the UI
  // updates smoothly without raising the background cadence.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 20 },
        (position) => {
          const point = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          useEngineStore.getState().setFix({
            point,
            accuracyMeters: position.coords.accuracy,
            speedMetersPerSecond: position.coords.speed,
            headingDegrees: position.coords.heading,
            timestamp: position.timestamp,
            provider: position.mocked ? 'mock' : 'fused',
          });

          evaluate(point);
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [evaluate]);

  // Platform geofence transitions, which arrive whether or not the UI is up.
  useEffect(() => {
    return subscribeToSystemEvents((event) => {
      const store = useEngineStore.getState();

      if (event.type === 'geofenceError') {
        store.pushDiagnostic({
          message: 'Geofence error',
          detail: event.message,
          severity: 'error',
        });
        return;
      }

      if (event.type === 'serviceHealth') {
        store.pushDiagnostic({
          message: event.running ? 'Background monitor started' : 'Background monitor stopped',
          detail: null,
          severity: event.running ? 'info' : 'warning',
        });
        store.refreshNativeState();
        return;
      }

      store.pushDiagnostic({
        message: event.type === 'geofenceEnter' ? 'Geofence enter' : 'Geofence exit',
        detail: event.zoneIds.join(', '),
        severity: 'info',
      });

      // The platform fence is a coarse circle, so confirm against real
      // geometry rather than trusting the transition on its own.
      if (event.latitude !== null && event.longitude !== null) {
        evaluate({ latitude: event.latitude, longitude: event.longitude });
      } else {
        void refreshLocation();
      }
    });
  }, [evaluate, refreshLocation]);

  // Keep the registered fence set in step with the user's zones.
  useEffect(() => {
    const unsubscribe = useZoneStore.subscribe((state, previous) => {
      if (state.zones === previous.zones) return;
      void syncGeofences(state.zones);
    });
    return unsubscribe;
  }, []);

  // Start and stop monitoring as the relevant settings change.
  useEffect(() => {
    const apply = () => {
      const { settings } = useSettingsStore.getState();
      const zones = useZoneStore.getState().zones;
      const engine = useEngineStore.getState().engine;
      const activeZone = engine.activeZoneId ? getZone(engine.activeZoneId) : null;

      if (settings.automationEnabled && settings.backgroundMonitoringEnabled) {
        void startZoneMonitoring(settings.trackingMode, zones, activeZone?.name ?? null);
      } else {
        void stopZoneMonitoring();
      }
    };

    apply();

    return useSettingsStore.subscribe((state, previous) => {
      const changed =
        state.settings.automationEnabled !== previous.settings.automationEnabled ||
        state.settings.backgroundMonitoringEnabled !== previous.settings.backgroundMonitoringEnabled ||
        state.settings.trackingMode !== previous.settings.trackingMode;
      if (changed) apply();
    });
  }, []);

  // Re-check permissions on resume: the user may have changed them in Settings
  // while we were backgrounded, and nothing notifies us of that.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      useEngineStore.getState().refreshNativeState();
      void refreshLocation();
    });
    return () => subscription.remove();
  }, [refreshLocation]);

  return { refreshLocation };
}
