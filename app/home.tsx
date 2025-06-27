import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type MapRef,
  type PressEventWithFeatures,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { ErrorBoundary } from '@/components/error-boundary';
import { CommandRing } from '@/components/prism/command-ring';
import { StatusChip } from '@/components/prism/status-chip';
import { BLUEPRINT_MAP_STYLE } from '@/constants/map-style';
import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import { getSetting } from '@/db/queries';
import { circlePolygonPoints, type LatLng } from '@/engine/geo';
import { useFieldEngine } from '@/hooks/use-field-engine';
import { useEngineStore } from '@/state/use-engine-store';
import { useFoldStore } from '@/state/use-fold-store';
import { pointsToLngLatRing, toLngLat } from '@/utils/map-geo';

const DEFAULT_CENTER: LatLng = { latitude: 37.78825, longitude: -122.4324 };
const DEFAULT_ZOOM = 14;
const FOCUSED_ZOOM = 16;

const BREATHE_MIN_WIDTH = 1.5;
const BREATHE_MAX_WIDTH = 4;

export default function HomeScreen() {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
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
        cameraRef.current?.easeTo({ center: toLngLat(coords), zoom: FOCUSED_ZOOM, duration: 500 });
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

  const foldsFeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: folds.map((fold) => {
        const isActive = fold.id === resolvedFold?.id;
        const strokeColor = EDGE_COLOR_HEX[fold.edgeColor];
        const ring =
          fold.geometry.type === 'circle'
            ? circlePolygonPoints(fold.geometry.center, fold.geometry.radiusMeters)
            : fold.geometry.points;
        return {
          type: 'Feature' as const,
          id: fold.id,
          properties: {
            foldId: fold.id,
            strokeColor,
            fillColor: `${strokeColor}33`,
            strokeWidth: isActive ? breatheWidth : 1.5,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [pointsToLngLatRing(ring)],
          },
        };
      }),
    }),
    [folds, resolvedFold, breatheWidth]
  );

  const debugFeatureCollection = useMemo(() => {
    if (!showGpsDebug || !currentLocation || accuracy == null) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [pointsToLngLatRing(circlePolygonPoints(currentLocation, accuracy))],
          },
        },
      ],
    };
  }, [showGpsDebug, currentLocation, accuracy]);

  const handleFoldPress = useCallback((event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const foldId = event.nativeEvent.features?.[0]?.properties?.foldId;
    if (typeof foldId === 'string') {
      router.push({ pathname: '/fold/[id]', params: { id: foldId } });
    }
  }, []);

  const recenter = useCallback(() => {
    if (!currentLocation) return;
    cameraRef.current?.easeTo({ center: toLngLat(currentLocation), zoom: FOCUSED_ZOOM, duration: 500 });
  }, [currentLocation]);

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
      <ErrorBoundary
        label="Home map"
        fallback={
          <View style={styles.mapFallback}>
            <MaterialIcons name="map" size={28} color="#4B5568" />
            <Text style={styles.mapFallbackText}>Map failed to load — check your connection</Text>
          </View>
        }>
        <MapLibreMap ref={mapRef} style={StyleSheet.absoluteFill} mapStyle={BLUEPRINT_MAP_STYLE}>
          <Camera
            ref={cameraRef}
            initialViewState={{ center: toLngLat(currentLocation ?? DEFAULT_CENTER), zoom: DEFAULT_ZOOM }}
          />
          <UserLocation animated accuracy={false} />

          <GeoJSONSource id="folds" data={foldsFeatureCollection} onPress={handleFoldPress}>
            <Layer type="fill" id="folds-fill" paint={{ 'fill-color': ['get', 'fillColor'] }} />
            <Layer
              type="line"
              id="folds-line"
              paint={{ 'line-color': ['get', 'strokeColor'], 'line-width': ['get', 'strokeWidth'] }}
            />
          </GeoJSONSource>

          {debugFeatureCollection && (
            <GeoJSONSource id="gps-debug" data={debugFeatureCollection}>
              <Layer
                type="line"
                id="gps-debug-line"
                paint={{ 'line-color': Prism.violet, 'line-width': 1 }}
              />
              <Layer type="fill" id="gps-debug-fill" paint={{ 'fill-color': Prism.violet, 'fill-opacity': 0.13 }} />
            </GeoJSONSource>
          )}
        </MapLibreMap>
      </ErrorBoundary>

      {currentLocation && (
        <Pressable style={styles.recenterButton} onPress={recenter}>
          <MaterialIcons name="my-location" size={20} color={Prism.ashPaper} />
        </Pressable>
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
  recenterButton: {
    position: 'absolute',
    bottom: 130,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(13,17,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
