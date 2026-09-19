import MapLibreGL from '@maplibre/maplibre-react-native';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SypauColor } from '@/constants/sypau';
import { SYPAU_MAP_STYLE } from '@/constants/map-style';
import { circlePolygonPoints, type Geometry, type LatLng } from '@/engine/geo';
import { pointsToLngLatRing, toLngLat } from '@/utils/map-geo';

/** A zone's outline as a closed ring, whatever shape it was drawn as. */
export function geometryToRing(geometry: Geometry): LatLng[] {
  if (geometry.type === 'circle') {
    return circlePolygonPoints(geometry.center, geometry.radiusMeters, 64);
  }
  return geometry.points;
}

export function geometryCenter(geometry: Geometry): LatLng {
  if (geometry.type === 'circle') return geometry.center;

  const points = geometry.points;
  if (points.length === 0) return { latitude: 0, longitude: 0 };

  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

type BoundaryProps = {
  id: string;
  geometry: Geometry;
  /** Dimmed when the zone is disabled. */
  muted?: boolean;
};

/** A zone boundary: cyan fill with a brighter stroke, per the references. */
export function ZoneBoundary({ id, geometry, muted = false }: BoundaryProps) {
  const shape = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [pointsToLngLatRing(geometryToRing(geometry))],
      },
    }),
    [geometry]
  );

  return (
    <MapLibreGL.ShapeSource id={`boundary-${id}`} shape={shape}>
      <MapLibreGL.FillLayer
        id={`boundaryFill-${id}`}
        style={{ fillColor: SypauColor.cyan, fillOpacity: muted ? 0.1 : 0.28 }}
      />
      <MapLibreGL.LineLayer
        id={`boundaryLine-${id}`}
        style={{
          lineColor: SypauColor.cyan,
          lineWidth: 2,
          lineOpacity: muted ? 0.4 : 1,
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}

type ZoneMapProps = {
  /** Zones to draw. The first one frames the camera when no centre is given. */
  geometries?: { id: string; geometry: Geometry; muted?: boolean }[];
  center?: LatLng | null;
  zoom?: number;
  userLocation?: LatLng | null;
  /** Off for thumbnails and previews. */
  interactive?: boolean;
  onPress?: (point: LatLng) => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * The shared map surface. Every map in the app goes through this so the style,
 * boundary colours and the cyan position marker stay consistent.
 */
export function ZoneMap({
  geometries = [],
  center,
  zoom = 14,
  userLocation,
  interactive = true,
  onPress,
  style,
  children,
}: ZoneMapProps) {
  const cameraCenter =
    center ?? (geometries[0] ? geometryCenter(geometries[0].geometry) : null) ?? userLocation;

  return (
    <View style={[styles.map, style]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        mapStyle={SYPAU_MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={
          onPress
            ? (feature) => {
                const coords = (feature.geometry as { coordinates: [number, number] }).coordinates;
                onPress({ longitude: coords[0], latitude: coords[1] });
              }
            : undefined
        }>
        {cameraCenter ? (
          <MapLibreGL.Camera
            zoomLevel={zoom}
            centerCoordinate={toLngLat(cameraCenter)}
            animationDuration={interactive ? 600 : 0}
          />
        ) : null}

        {geometries.map((entry) => (
          <ZoneBoundary
            key={entry.id}
            id={entry.id}
            geometry={entry.geometry}
            muted={entry.muted}
          />
        ))}

        {userLocation ? <UserMarker point={userLocation} /> : null}

        {children}
      </MapLibreGL.MapView>
    </View>
  );
}

/** Live position: a cyan dot with a soft halo, as in the debug reference. */
export function UserMarker({ point }: { point: LatLng }) {
  return (
    <MapLibreGL.MarkerView coordinate={toLngLat(point)} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.userHalo}>
        <View style={styles.userDot} />
      </View>
    </MapLibreGL.MarkerView>
  );
}

/** Draggable vertex handle used by the boundary editor. */
export function VertexHandle({ point, onPress }: { point: LatLng; onPress?: () => void }) {
  return (
    <MapLibreGL.MarkerView coordinate={toLngLat(point)} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.vertex} onTouchEnd={onPress} />
    </MapLibreGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', backgroundColor: SypauColor.surface },
  userHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(69, 199, 196, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: SypauColor.cyan,
    borderWidth: 2,
    borderColor: SypauColor.ink,
  },
  vertex: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SypauColor.paper,
    borderWidth: 2.5,
    borderColor: SypauColor.cyan,
  },
});
