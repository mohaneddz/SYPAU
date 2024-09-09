import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';

import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/prism/button';
import { BLUEPRINT_MAP_STYLE } from '@/constants/map-style';
import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { ICON_TYPE_META, ICON_TYPE_ORDER } from '@/constants/icon-types';
import type { Geometry, LatLng } from '@/engine/geo';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';
import type { EdgeColor, IconType } from '@/types/fold';
import { canRenderGoogleMaps } from '@/utils/maps-config';

type DrawMode = 'polygon' | 'circle' | 'freehand';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MIN_FREEHAND_POINT_DISTANCE_PX = 10;
const DEFAULT_RADIUS_M = 80;
const RADIUS_STEP_M = 20;
const MIN_RADIUS_M = 20;
const MAX_RADIUS_M = 500;
const mapsAvailable = canRenderGoogleMaps();

export default function CreateFoldScreen() {
  const mapRef = useRef<MapView>(null);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const addFold = useFoldStore((state) => state.addFold);
  const updateFold = useFoldStore((state) => state.updateFold);
  const editingFold = useFoldStore((state) => (editId ? state.folds.find((f) => f.id === editId) : undefined));
  const profiles = useProfileStore((state) => state.profiles);

  const [step, setStep] = useState<1 | 2 | 3>(editingFold ? 2 : 1);
  const [drawMode, setDrawMode] = useState<DrawMode>(editingFold?.geometry.type === 'circle' ? 'circle' : 'polygon');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [mapLayout, setMapLayout] = useState({ width: 1, height: 1 });

  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>(() =>
    editingFold?.geometry.type === 'polygon' ? editingFold.geometry.points : []
  );
  const [circleCenter, setCircleCenter] = useState<LatLng | null>(() =>
    editingFold?.geometry.type === 'circle' ? editingFold.geometry.center : null
  );
  const [circleRadius, setCircleRadius] = useState(() =>
    editingFold?.geometry.type === 'circle' ? editingFold.geometry.radiusMeters : DEFAULT_RADIUS_M
  );
  const freehandAnchor = useRef<{ coordinate: LatLng; x: number; y: number } | null>(null);

  const [name, setName] = useState(editingFold?.name ?? '');
  const [iconType, setIconType] = useState<IconType>(editingFold?.iconType ?? 'custom');
  const [edgeColor, setEdgeColor] = useState<EdgeColor>(editingFold?.edgeColor ?? 'cyan');
  const [priority, setPriority] = useState(editingFold?.priority ?? 5);
  const [profileId, setProfileId] = useState<string | null>(editingFold?.profileId ?? null);

  const selectedProfileId = useMemo(() => {
    if (profileId) return profileId;
    const match = profiles.find((p) => p.presetKey === iconType);
    return match?.id ?? profiles[0]?.id ?? null;
  }, [profileId, profiles, iconType]);

  useMemo(() => {
    (async () => {
      if (editingFold) {
        const center =
          editingFold.geometry.type === 'circle' ? editingFold.geometry.center : editingFold.geometry.points[0];
        const nextRegion = { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 400);
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return;
      try {
        const current = await Location.getCurrentPositionAsync({});
        const nextRegion = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 400);
      } catch {
        // No fix yet — fall back to the default region.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => drawMode === 'freehand',
        onMoveShouldSetPanResponder: () => drawMode === 'freehand',
        onPanResponderGrant: async (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const coordinate = await mapRef.current?.coordinateForPoint({ x: locationX, y: locationY });
          if (!coordinate) return;
          freehandAnchor.current = { coordinate, x: locationX, y: locationY };
          setPolygonPoints([coordinate]);
        },
        onPanResponderMove: (event) => {
          const anchor = freehandAnchor.current;
          if (!anchor || mapLayout.width <= 1) return;
          const { locationX, locationY } = event.nativeEvent;
          const dx = locationX - anchor.x;
          const dy = locationY - anchor.y;
          if (Math.hypot(dx, dy) < MIN_FREEHAND_POINT_DISTANCE_PX) return;

          const lngPerPx = region.longitudeDelta / mapLayout.width;
          const latPerPx = region.latitudeDelta / mapLayout.height;
          const next: LatLng = {
            latitude: anchor.coordinate.latitude - dy * latPerPx,
            longitude: anchor.coordinate.longitude + dx * lngPerPx,
          };
          freehandAnchor.current = { coordinate: next, x: locationX, y: locationY };
          setPolygonPoints((points) => [...points, next]);
        },
        onPanResponderRelease: () => {
          freehandAnchor.current = null;
        },
      }),
    [drawMode, region, mapLayout]
  );

  const handleMapPress = (event: MapPressEvent) => {
    const coordinate = event.nativeEvent?.coordinate;
    if (!coordinate) return;

    if (drawMode === 'polygon') {
      setPolygonPoints((points) => [...points, coordinate]);
    } else if (drawMode === 'circle' && !circleCenter) {
      setCircleCenter(coordinate);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleMapLayout = (event: LayoutChangeEvent) => {
    setMapLayout({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  };

  const canFinishGeometry =
    (drawMode === 'polygon' && polygonPoints.length >= 3) ||
    (drawMode === 'freehand' && polygonPoints.length >= 3) ||
    (drawMode === 'circle' && circleCenter !== null);

  const finishGeometry = () => {
    if (!canFinishGeometry) {
      Alert.alert('Not enough points', 'Trace at least 3 points to close a shape.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(3);
  };

  const resetGeometry = () => {
    setPolygonPoints([]);
    setCircleCenter(null);
    setCircleRadius(DEFAULT_RADIUS_M);
  };

  const geometry: Geometry | null = useMemo(() => {
    if (drawMode === 'circle') {
      return circleCenter ? { type: 'circle', center: circleCenter, radiusMeters: circleRadius } : null;
    }
    return polygonPoints.length >= 3 ? { type: 'polygon', points: polygonPoints } : null;
  }, [drawMode, circleCenter, circleRadius, polygonPoints]);

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give this Fold a name before saving.');
      return;
    }
    if (!geometry || !selectedProfileId) {
      Alert.alert('Missing info', 'Draw a shape and pick a profile first.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editingFold) {
      updateFold(editingFold.id, { name: trimmedName, geometry, iconType, edgeColor, priority, profileId: selectedProfileId });
    } else {
      addFold({ name: trimmedName, geometry, iconType, edgeColor, priority, profileId: selectedProfileId });
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: editingFold ? 'Edit Fold' : 'Create Fold' }} />
      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Pick a draw mode</Text>
          {(
            [
              { key: 'freehand', label: 'Freehand', desc: 'Trace a shape with your finger', icon: 'gesture' },
              { key: 'circle', label: 'Circle', desc: 'Tap a center, set a radius', icon: 'panorama-fish-eye' },
              { key: 'polygon', label: 'Polygon', desc: 'Tap point by point', icon: 'timeline' },
            ] as const
          ).map((mode) => (
            <Pressable
              key={mode.key}
              style={[styles.modeCard, drawMode === mode.key && styles.modeCardSelected]}
              onPress={() => {
                setDrawMode(mode.key);
                resetGeometry();
              }}>
              <MaterialIcons name={mode.icon} size={28} color={Prism.cyan} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modeLabel}>{mode.label}</Text>
                <Text style={styles.modeDesc}>{mode.desc}</Text>
              </View>
              {drawMode === mode.key && <MaterialIcons name="check-circle" size={22} color={Prism.cyan} />}
            </Pressable>
          ))}
          <Button onPress={() => setStep(2)}>Continue</Button>
        </View>
      )}

      {step === 2 && (
        <View style={styles.mapStep}>
          <View style={styles.mapWrapper} onLayout={handleMapLayout} {...panResponder.panHandlers}>
            {mapsAvailable ? (
              <ErrorBoundary
                label="Create Fold map"
                fallback={
                  <View style={styles.mapFallback}>
                    <MaterialIcons name="map" size={28} color="#4B5568" />
                    <Text style={styles.mapFallbackText}>
                      Map unavailable — check the Google Maps API key in app.json
                    </Text>
                  </View>
                }>
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFill}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={region}
                  onRegionChangeComplete={setRegion}
                  customMapStyle={Platform.OS === 'android' ? BLUEPRINT_MAP_STYLE : undefined}
                  scrollEnabled={drawMode !== 'freehand'}
                  zoomEnabled={drawMode !== 'freehand'}
                  onPress={handleMapPress}>
                  {drawMode !== 'circle' && polygonPoints.length > 0 && (
                    <Polygon
                      coordinates={polygonPoints}
                      strokeColor={Prism.cyan}
                      fillColor={`${Prism.cyan}22`}
                      strokeWidth={2}
                      lineDashPattern={drawMode === 'polygon' ? [6, 4] : undefined}
                    />
                  )}
                  {drawMode === 'polygon' &&
                    polygonPoints.map((point, index) => (
                      <Marker key={index} coordinate={point} anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={styles.vertexMarker} />
                      </Marker>
                    ))}
                  {drawMode === 'circle' && circleCenter && (
                    <Circle
                      center={circleCenter}
                      radius={circleRadius}
                      strokeColor={Prism.cyan}
                      fillColor={`${Prism.cyan}22`}
                      strokeWidth={2}
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
          </View>

          {drawMode === 'circle' && circleCenter && (
            <View style={styles.radiusControl}>
              <Pressable
                style={styles.radiusButton}
                onPress={() => setCircleRadius((r) => Math.max(MIN_RADIUS_M, r - RADIUS_STEP_M))}>
                <MaterialIcons name="remove" size={20} color={Prism.ashPaper} />
              </Pressable>
              <Text style={styles.radiusLabel}>{circleRadius} m</Text>
              <Pressable
                style={styles.radiusButton}
                onPress={() => setCircleRadius((r) => Math.min(MAX_RADIUS_M, r + RADIUS_STEP_M))}>
                <MaterialIcons name="add" size={20} color={Prism.ashPaper} />
              </Pressable>
            </View>
          )}

          <View style={styles.mapControls}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                resetGeometry();
                setStep(1);
              }}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.pointCount}>
              {drawMode === 'circle' ? (circleCenter ? 'Center set' : 'Tap to set center') : `${polygonPoints.length} points`}
            </Text>
            <Pressable
              style={[styles.primaryButton, !canFinishGeometry && styles.primaryButtonDisabled]}
              disabled={!canFinishGeometry}
              onPress={finishGeometry}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <ScrollView style={styles.configScroll} contentContainerStyle={styles.stepContainer}>
          <Text style={styles.stepTitle}>Configure this Fold</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Office Fold"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Icon</Text>
          <View style={styles.grid}>
            {ICON_TYPE_ORDER.map((key) => {
              const meta = ICON_TYPE_META[key];
              return (
                <Pressable
                  key={key}
                  style={[styles.iconCell, iconType === key && styles.iconCellSelected]}
                  onPress={() => {
                    setIconType(key);
                    setProfileId(null);
                  }}>
                  <MaterialIcons name={meta.icon} size={22} color={iconType === key ? Prism.inkBlack : Prism.ashPaper} />
                  <Text style={[styles.iconCellLabel, iconType === key && styles.iconCellLabelSelected]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Edge color</Text>
          <View style={styles.row}>
            {(['cyan', 'violet', 'amber'] as EdgeColor[]).map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: EDGE_COLOR_HEX[color] },
                  edgeColor === color && styles.colorSwatchSelected,
                ]}
                onPress={() => setEdgeColor(color)}
              />
            ))}
          </View>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.radiusButton} onPress={() => setPriority((p) => Math.max(1, p - 1))}>
              <MaterialIcons name="remove" size={20} color={Prism.ashPaper} />
            </Pressable>
            <Text style={styles.radiusLabel}>{priority}</Text>
            <Pressable style={styles.radiusButton} onPress={() => setPriority((p) => Math.min(10, p + 1))}>
              <MaterialIcons name="add" size={20} color={Prism.ashPaper} />
            </Pressable>
          </View>

          <Text style={styles.label}>Profile</Text>
          <View style={styles.chipRow}>
            {profiles.map((profile) => (
              <Pressable
                key={profile.id}
                style={[styles.chip, selectedProfileId === profile.id && styles.chipSelected]}
                onPress={() => setProfileId(profile.id)}>
                <Text style={[styles.chipText, selectedProfileId === profile.id && styles.chipTextSelected]}>
                  {profile.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.configActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setStep(2)}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Button onPress={save} style={{ flex: 1 }}>
              {editingFold ? 'Save Changes' : 'Save Fold'}
            </Button>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  stepContainer: {
    padding: 20,
    gap: 14,
  },
  stepTitle: {
    ...PrismType.h2,
    color: Prism.ashPaper,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Prism.paperShadow,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeCardSelected: {
    borderColor: Prism.cyan,
  },
  modeLabel: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  modeDesc: {
    ...PrismType.caption,
    color: '#8892A6',
  },
  mapStep: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
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
  vertexMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Prism.cyan,
    borderWidth: 2,
    borderColor: Prism.inkBlack,
  },
  radiusControl: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(13,17,28,0.9)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  radiusButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusLabel: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  mapControls: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointCount: {
    ...PrismType.caption,
    color: Prism.ashPaper,
  },
  primaryButton: {
    backgroundColor: Prism.cyan,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Prism.inkBlack,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  secondaryButtonText: {
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  configScroll: {
    flex: 1,
  },
  input: {
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Prism.ashPaper,
    fontSize: 15,
  },
  label: {
    ...PrismType.caption,
    color: '#8892A6',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconCell: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconCellSelected: {
    backgroundColor: Prism.cyan,
    borderColor: Prism.cyan,
  },
  iconCellLabel: {
    ...PrismType.caption,
    color: Prism.ashPaper,
  },
  iconCellLabelSelected: {
    color: Prism.inkBlack,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: Prism.ashPaper,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: Prism.cyan,
  },
  chipText: {
    color: '#9AA3B2',
    fontSize: 13,
  },
  chipTextSelected: {
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  configActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
});
