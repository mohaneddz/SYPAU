import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';

import { ErrorBoundary } from '@/components/error-boundary';
import { CommandRing } from '@/components/prism/command-ring';
import { StatusChip } from '@/components/prism/status-chip';
import { BLUEPRINT_MAP_STYLE } from '@/constants/map-style';
import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import { getSetting } from '@/db/queries';
import type { LatLng } from '@/engine/geo';
import { useFieldEngine } from '@/hooks/use-field-engine';
import { useEngineStore } from '@/state/use-engine-store';
import { useFoldStore } from '@/state/use-fold-store';
import { canRenderGoogleMaps } from '@/utils/maps-config';

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const BREATHE_MIN_WIDTH = 1.5;
const BREATHE_MAX_WIDTH = 4;
const mapsAvailable = canRenderGoogleMaps();

export default function HomeScreen() {
  const mapRef = useRef<MapView>(null);
  const folds = useFoldStore((state) => state.folds);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [breatheWidth, setBreatheWidth] = useState(BREATHE_MIN_WIDTH);
  const [showGpsDebug, setShowGpsDebug] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowGpsDebug(getSetting(getDb(), SETTINGS_KEYS.showGpsDebug, false));
    }, [])
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== Location.PermissionStatus.GRANTED) return;

      try {
        const initial = await Location.getCurrentPositionAsync({});
        const coords = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setCurrentLocation(coords);
        setAccuracy(initial.coords.accuracy ?? null);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
      } catch {
        // No fix yet — watchPositionAsync below will pick it up once available.
      }
    })();
  }, []);

  useEffect(() => {
    if (permissionStatus !== Location.PermissionStatus.GRANTED) return;

    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 8 },
        (update) => {
          setCurrentLocation({
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          });
          setAccuracy(update.coords.accuracy ?? null);
        }
      );
    })();

    return () => subscription?.remove();
  }, [permissionStatus]);

  useEffect(() => {
    let raf: ReturnType<typeof setInterval>;
    const start = Date.now();
    raf = setInterval(() => {
      const t = (Date.now() - start) / 2400;
      const phase = (Math.sin(t * Math.PI * 2) + 1) / 2;
      setBreatheWidth(BREATHE_MIN_WIDTH + phase * (BREATHE_MAX_WIDTH - BREATHE_MIN_WIDTH));
    }, 100);
    return () => clearInterval(raf);
  }, []);

  const engineStatus = useEngineStore((state) => state.status);
  const resolvedFoldId = useEngineStore((state) => state.resolvedFoldId);
  const resolvedFold = useMemo(() => folds.find((f) => f.id === resolvedFoldId) ?? null, [folds, resolvedFoldId]);

  useEffect(() => {
    useEngineStore.getState().setLocation(currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    if (permissionStatus !== Location.PermissionStatus.GRANTED) {
      useEngineStore.getState().setStatus('idle');
    }
  }, [permissionStatus]);

  useFieldEngine(currentLocation, folds);

  if (permissionStatus && permissionStatus !== Location.PermissionStatus.GRANTED) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Location access needed</Text>
        <Text style={styles.permissionBody}>
          SYPAU needs location access to detect when you enter or leave a Fold.
        </Text>
        <Pressable
          style={styles.grantButton}
          onPress={async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setPermissionStatus(status);
          }}>
          <Text style={styles.grantButtonText}>Grant Location Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {mapsAvailable ? (
        <ErrorBoundary
          label="Home map"
          fallback={
            <View style={styles.mapFallback}>
              <MaterialIcons name="map" size={28} color="#4B5568" />
              <Text style={styles.mapFallbackText}>Map unavailable — check the Google Maps API key in app.json</Text>
            </View>
          }>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={
              currentLocation ? { ...currentLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 } : DEFAULT_REGION
            }
            customMapStyle={Platform.OS === 'android' ? BLUEPRINT_MAP_STYLE : undefined}
            showsUserLocation>
            {folds.map((fold) => {
              const isActive = fold.id === resolvedFold?.id;
              const strokeColor = EDGE_COLOR_HEX[fold.edgeColor];
              const strokeWidth = isActive ? breatheWidth : 1.5;
              const onPress = () => router.push({ pathname: '/fold/[id]', params: { id: fold.id } });

              if (fold.geometry.type === 'circle') {
                // MapCircle has no onPress — reachable via My Fields instead.
                return (
                  <Circle
                    key={fold.id}
                    center={fold.geometry.center}
                    radius={fold.geometry.radiusMeters}
                    strokeColor={strokeColor}
                    fillColor={`${strokeColor}33`}
                    strokeWidth={strokeWidth}
                  />
                );
              }
              return (
                <Polygon
                  key={fold.id}
                  coordinates={fold.geometry.points}
                  strokeColor={strokeColor}
                  fillColor={`${strokeColor}33`}
                  strokeWidth={strokeWidth}
                  tappable
                  onPress={onPress}
                />
              );
            })}

            {showGpsDebug && currentLocation && accuracy != null && (
              <Circle
                center={currentLocation}
                radius={accuracy}
                strokeColor={Prism.violet}
                fillColor={`${Prism.violet}22`}
                strokeWidth={1}
              />
            )}
          </MapView>
        </ErrorBoundary>
      ) : (
        <View style={styles.mapFallback}>
          <MaterialIcons name="map" size={28} color="#4B5568" />
          <Text style={styles.mapFallbackText}>Map unavailable — add a Google Maps API key in app.json</Text>
        </View>
      )}

      {showGpsDebug && currentLocation && (
        <View style={styles.debugOverlay} pointerEvents="none">
          <Text style={styles.debugText}>
            {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
          </Text>
          <Text style={styles.debugText}>±{accuracy != null ? Math.round(accuracy) : '?'}m accuracy</Text>
        </View>
      )}

      <View style={styles.topBar} pointerEvents="box-none">
        <StatusChip label={engineStatus.toUpperCase()} variant={engineStatus} />
        <View style={styles.activeFoldChip} pointerEvents="none">
          <Text style={styles.activeFoldText}>{resolvedFold ? resolvedFold.name : 'No active fold'}</Text>
        </View>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={22} color={Prism.ashPaper} />
        </Pressable>
      </View>

      {resolvedFold && (
        <View style={styles.enginePill} pointerEvents="none">
          <Text style={styles.enginePillText}>Inside: {resolvedFold.name} — ENGAGED</Text>
        </View>
      )}

      <CommandRing
        onDrawFold={() => router.push('/fold/new')}
        onMyFields={() => router.push('/fields')}
        onModes={() => router.push('/modes')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  permissionTitle: {
    ...PrismType.h2,
    color: Prism.ashPaper,
  },
  permissionBody: {
    ...PrismType.body,
    color: '#9AA3B2',
    textAlign: 'center',
  },
  grantButton: {
    marginTop: 12,
    backgroundColor: Prism.cyan,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  grantButtonText: {
    color: Prism.inkBlack,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeFoldChip: {
    backgroundColor: 'rgba(13,17,28,0.85)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  activeFoldText: {
    ...PrismType.caption,
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(13,17,28,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enginePill: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    backgroundColor: 'rgba(52,246,211,0.15)',
    borderColor: Prism.cyan,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  enginePillText: {
    ...PrismType.caption,
    color: Prism.cyan,
    fontWeight: '700',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 130,
    left: 16,
    backgroundColor: 'rgba(123,92,255,0.16)',
    borderColor: Prism.violet,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debugText: {
    ...PrismType.caption,
    color: Prism.violet,
    fontVariant: ['tabular-nums'],
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  mapFallbackText: {
    ...PrismType.body,
    color: '#8892A6',
    textAlign: 'center',
  },
});
