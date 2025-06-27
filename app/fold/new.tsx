import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type MapRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/prism/button';
import { BLUEPRINT_MAP_STYLE } from '@/constants/map-style';
import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { ICON_TYPE_META, ICON_TYPE_ORDER } from '@/constants/icon-types';
import { circlePolygonPoints, type Geometry, type LatLng } from '@/engine/geo';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';
import type { EdgeColor, IconType } from '@/types/fold';
import { fromLngLat, pointsToLngLatRing, toLngLat, type LngLat } from '@/utils/map-geo';

type DrawMode = 'polygon' | 'circle' | 'freehand';
type LngLatBounds = [west: number, south: number, east: number, north: number];

const DEFAULT_CENTER: LatLng = { latitude: 37.78825, longitude: -122.4324 };
const DEFAULT_ZOOM = 14;
const FOCUSED_ZOOM = 16;

const MIN_FREEHAND_POINT_DISTANCE_PX = 10;
const DEFAULT_RADIUS_M = 80;
const RADIUS_STEP_M = 20;
const MIN_RADIUS_M = 20;
const MAX_RADIUS_M = 500;

export default function CreateFoldScreen() {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const addFold = useFoldStore((state) => state.addFold);
  const updateFold = useFoldStore((state) => state.updateFold);
  const editingFold = useFoldStore((state) => (editId ? state.folds.find((f) => f.id === editId) : undefined));
  const profiles = useProfileStore((state) => state.profiles);

  const [step, setStep] = useState<1 | 2 | 3>(editingFold ? 2 : 1);
  const [drawMode, setDrawMode] = useState<DrawMode>(editingFold?.geometry.type === 'circle' ? 'circle' : 'polygon');
  const [mapBounds, setMapBounds] = useState<LngLatBounds | null>(null);
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

  const initialCenter = useMemo<LatLng>(() => {
    if (editingFold) {
      return editingFold.geometry.type === 'circle' ? editingFold.geometry.center : editingFold.geometry.points[0];
    }
    return DEFAULT_CENTER;
  }, [editingFold]);

  useEffect(() => {
    if (editingFold) {
      cameraRef.current?.easeTo({ center: toLngLat(initialCenter), zoom: FOCUSED_ZOOM, duration: 400 });
      return;
    }
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return;
      try {
        const current = await Location.getCurrentPositionAsync({});
        const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        cameraRef.current?.easeTo({ center: toLngLat(coords), zoom: FOCUSED_ZOOM, duration: 400 });
      } catch {
        // No fix yet — fall back to the default center.
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
          const lngLat = await mapRef.current?.unproject([locationX, locationY]);
          if (!lngLat) return;
          const coordinate = fromLngLat(lngLat);
          freehandAnchor.current = { coordinate, x: locationX, y: locationY };
          setPolygonPoints([coordinate]);
        },
        onPanResponderMove: (event) => {
          const anchor = freehandAnchor.current;
          if (!anchor || mapLayout.width <= 1 || !mapBounds) return;
          const { locationX, locationY } = event.nativeEvent;
          const dx = locationX - anchor.x;
          const dy = locationY - anchor.y;
          if (Math.hypot(dx, dy) < MIN_FREEHAND_POINT_DISTANCE_PX) return;

          const [west, south, east, north] = mapBounds;
          const lngPerPx = (east - west) / mapLayout.width;
          const latPerPx = (north - south) / mapLayout.height;
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
    [drawMode, mapBounds, mapLayout]
  );

  const handleMapPress = (event: NativeSyntheticEvent<PressEvent>) => {
    const lngLat = event.nativeEvent?.lngLat;
    if (!lngLat) return;
    const coordinate = fromLngLat(lngLat as LngLat);

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

  const undoLastPoint = () => {
    setPolygonPoints((points) => points.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const polygonPreview = useMemo(() => {
    if (drawMode === 'circle' || polygonPoints.length < 2) return null;
    const geometry: GeoJSON.Geometry =
      polygonPoints.length >= 3
        ? { type: 'Polygon', coordinates: [pointsToLngLatRing(polygonPoints)] }
        : { type: 'LineString', coordinates: polygonPoints.map(toLngLat) };
    return {
      type: 'FeatureCollection' as const,
      features: [{ type: 'Feature' as const, properties: {}, geometry }],
    };
  }, [drawMode, polygonPoints]);

  const circlePreview = useMemo(() => {
    if (drawMode !== 'circle' || !circleCenter) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [pointsToLngLatRing(circlePolygonPoints(circleCenter, circleRadius))],
          },
        },
      ],
    };
  }, [drawMode, circleCenter, circleRadius]);

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
            <ErrorBoundary
              label="Create Fold map"
              fallback={
                <View style={styles.mapFallback}>
                  <MaterialIcons name="map" size={28} color="#4B5568" />
                  <Text style={styles.mapFallbackText}>Map failed to load — check your connection</Text>
                </View>
              }>
              <MapLibreMap
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                mapStyle={BLUEPRINT_MAP_STYLE}
                dragPan={drawMode !== 'freehand'}
                touchZoom={drawMode !== 'freehand'}
                onRegionDidChange={(event) => setMapBounds(event.nativeEvent.bounds)}
                onPress={handleMapPress}>
                <Camera ref={cameraRef} initialViewState={{ center: toLngLat(initialCenter), zoom: DEFAULT_ZOOM }} />

                {polygonPreview && (
                  <GeoJSONSource id="polygon-preview" data={polygonPreview}>
                    <Layer type="fill" id="polygon-preview-fill" paint={{ 'fill-color': Prism.cyan, 'fill-opacity': 0.13 }} />
                    <Layer
                      type="line"
                      id="polygon-preview-line"
                      paint={{
                        'line-color': Prism.cyan,
                        'line-width': 2,
                        ...(drawMode === 'polygon' ? { 'line-dasharray': [2, 1.5] } : {}),
                      }}
                    />
                  </GeoJSONSource>
                )}

                {drawMode === 'polygon' &&
                  polygonPoints.map((point, index) => (
                    <Marker key={index} id={`vertex-${index}`} lngLat={toLngLat(point)} anchor="center">
                      <View style={styles.vertexMarker} />
                    </Marker>
                  ))}

                {circlePreview && (
                  <GeoJSONSource id="circle-preview" data={circlePreview}>
                    <Layer type="fill" id="circle-preview-fill" paint={{ 'fill-color': Prism.cyan, 'fill-opacity': 0.13 }} />
                    <Layer type="line" id="circle-preview-line" paint={{ 'line-color': Prism.cyan, 'line-width': 2 }} />
                  </GeoJSONSource>
                )}
              </MapLibreMap>
            </ErrorBoundary>
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

          {drawMode !== 'circle' && polygonPoints.length > 0 && (
            <Pressable style={styles.undoButton} onPress={undoLastPoint}>
              <MaterialIcons name="undo" size={18} color={Prism.ashPaper} />
              <Text style={styles.undoButtonText}>Undo point</Text>
            </Pressable>
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
  undoButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,17,28,0.9)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoButtonText: {
    ...PrismType.caption,
    color: Prism.ashPaper,
    fontWeight: '600',
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
