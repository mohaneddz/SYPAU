import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';

import { EDGE_COLOR_HEX, Prism } from '@/constants/prism';
import type { LatLng } from '@/engine/geo';
import { activeFoldSet, resolveFold } from '@/engine/overlap';
import { useFoldStore } from '@/state/use-fold-store';
import type { EdgeColor, ProfileKey } from '@/types/fold';

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const PROFILE_OPTIONS: { key: ProfileKey; label: string }[] = [
  { key: 'school', label: 'School' },
  { key: 'studying', label: 'Studying' },
  { key: 'sleeping', label: 'Sleeping' },
  { key: 'awake', label: 'Awake' },
  { key: 'tired', label: 'Tired' },
  { key: 'praying', label: 'Praying' },
  { key: 'silent', label: 'Silent' },
  { key: 'custom', label: 'Custom' },
];

const EDGE_COLOR_OPTIONS: EdgeColor[] = ['cyan', 'violet', 'amber'];

const HYSTERESIS_BUFFER_METERS = 15;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const folds = useFoldStore((state) => state.folds);
  const addFold = useFoldStore((state) => state.addFold);
  const toggleFold = useFoldStore((state) => state.toggleFold);
  const removeFold = useFoldStore((state) => state.removeFold);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<LatLng[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [foldName, setFoldName] = useState('');
  const [profileKey, setProfileKey] = useState<ProfileKey>('custom');
  const [edgeColor, setEdgeColor] = useState<EdgeColor>('cyan');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== Location.PermissionStatus.GRANTED) return;

      const initial = await Location.getCurrentPositionAsync({});
      const coords = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      setCurrentLocation(coords);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
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
        }
      );
    })();

    return () => subscription?.remove();
  }, [permissionStatus]);

  const resolvedFold = useMemo(() => {
    if (!currentLocation) return null;
    const candidates = activeFoldSet(currentLocation, folds, HYSTERESIS_BUFFER_METERS);
    return resolveFold(candidates);
  }, [currentLocation, folds]);

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      if (!isDrawing) return;
      const coordinate = event.nativeEvent?.coordinate;
      if (!coordinate) return;
      setDrawnPoints((points) => [...points, coordinate]);
    },
    [isDrawing]
  );

  const startDrawing = () => {
    setDrawnPoints([]);
    setIsDrawing(true);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  const closeShape = () => {
    if (drawnPoints.length < 3) {
      Alert.alert('Needs more points', 'Tap at least 3 points on the map to close a Fold.');
      return;
    }
    setFoldName('');
    setProfileKey('custom');
    setEdgeColor('cyan');
    setSaveModalVisible(true);
  };

  const saveFold = () => {
    const name = foldName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this Fold a name before saving.');
      return;
    }
    addFold({ name, geometryJson: drawnPoints, profileKey, edgeColor });
    setSaveModalVisible(false);
    setIsDrawing(false);
    setDrawnPoints([]);
  };

  if (permissionStatus && permissionStatus !== Location.PermissionStatus.GRANTED) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Location access needed</Text>
        <Text style={styles.permissionBody}>
          SYPAU needs location access to detect when you enter or leave a Fold.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setPermissionStatus(status);
          }}>
          <Text style={styles.primaryButtonText}>Grant Location Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={
          currentLocation ? { ...currentLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 } : DEFAULT_REGION
        }
        showsUserLocation
        onPress={handleMapPress}>
        {folds.map((fold) => (
          <Polygon
            key={fold.id}
            coordinates={fold.geometryJson}
            strokeColor={EDGE_COLOR_HEX[fold.edgeColor]}
            fillColor={`${EDGE_COLOR_HEX[fold.edgeColor]}33`}
            strokeWidth={fold.id === resolvedFold?.id ? 3 : 1.5}
            tappable
            onPress={() =>
              Alert.alert(fold.name, `Priority ${fold.priority} · ${fold.profileKey}`, [
                { text: fold.enabled ? 'Disable' : 'Enable', onPress: () => toggleFold(fold.id) },
                { text: 'Delete', style: 'destructive', onPress: () => removeFold(fold.id) },
                { text: 'Close', style: 'cancel' },
              ])
            }
          />
        ))}

        {isDrawing && drawnPoints.length > 0 && (
          <Polygon
            coordinates={drawnPoints}
            strokeColor={Prism.cyan}
            fillColor={`${Prism.cyan}22`}
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        )}
        {isDrawing &&
          drawnPoints.map((point, index) => (
            <Marker key={index} coordinate={point} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.vertexMarker} />
            </Marker>
          ))}
      </MapView>

      <View style={styles.statusChip} pointerEvents="none">
        <Text style={styles.statusChipText}>
          {resolvedFold ? `Inside: ${resolvedFold.name}` : 'No active fold'}
        </Text>
      </View>

      <View style={styles.controls}>
        {!isDrawing ? (
          <Pressable style={styles.primaryButton} onPress={startDrawing}>
            <Text style={styles.primaryButtonText}>Draw Fold</Text>
          </Pressable>
        ) : (
          <View style={styles.drawingControls}>
            <Pressable style={styles.secondaryButton} onPress={cancelDrawing}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.pointCount}>{drawnPoints.length} points</Text>
            <Pressable style={styles.primaryButton} onPress={closeShape}>
              <Text style={styles.primaryButtonText}>Close Shape</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={saveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this Fold</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Office Fold"
              placeholderTextColor="#6B7280"
              value={foldName}
              onChangeText={setFoldName}
              autoFocus
            />

            <Text style={styles.modalLabel}>Profile</Text>
            <View style={styles.chipRow}>
              {PROFILE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.chip, profileKey === option.key && styles.chipSelected]}
                  onPress={() => setProfileKey(option.key)}>
                  <Text style={[styles.chipText, profileKey === option.key && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Edge color</Text>
            <View style={styles.chipRow}>
              {EDGE_COLOR_OPTIONS.map((color) => (
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

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveFold}>
                <Text style={styles.primaryButtonText}>Save Fold</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    color: Prism.ashPaper,
    fontSize: 20,
    fontWeight: '700',
  },
  permissionBody: {
    color: '#9AA3B2',
    fontSize: 14,
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
  statusChip: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(13,17,28,0.85)',
    borderColor: Prism.cyan,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusChipText: {
    color: Prism.ashPaper,
    fontSize: 13,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
  },
  drawingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pointCount: {
    color: Prism.ashPaper,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: Prism.cyan,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Prism.inkBlack,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Prism.ashPaper,
    fontWeight: '600',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,6,10,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Prism.deepCharcoal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    color: Prism.ashPaper,
    fontSize: 18,
    fontWeight: '700',
  },
  modalLabel: {
    color: '#9AA3B2',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Prism.ashPaper,
    fontSize: 15,
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
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: Prism.ashPaper,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
});
