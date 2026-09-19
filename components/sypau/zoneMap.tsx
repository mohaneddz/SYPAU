import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SYPAU_MAP_STYLE } from '@/constants/map-style';
import { SypauColor } from '@/constants/sypau';
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
  const data = useMemo<GeoJSON.Feature>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [pointsToLngLatRing(geometryToRing(geometry))],
      },
    }),
    [geometry]
  );

  return (
    <GeoJSONSource id={`boundary${id}`} data={data}>
      <Layer
        id={`boundaryFill${id}`}
        type="fill"
        paint={{ 'fill-color': SypauColor.cyan, 'fill-opacity': muted ? 0.1 : 0.28 }}
      />
      <Layer
        id={`boundaryLine${id}`}
        type="line"
        paint={{
          'line-color': SypauColor.cyan,
          'line-width': 2,
          'line-opacity': muted ? 0.4 : 1,
        }}
      />
    </GeoJSONSource>
  );
}

export type ZoneMapHandle = {
  flyTo: (point: LatLng, zoom?: number) => void;
  zoomBy: (delta: number) => void;
};

type ZoneMapProps = {
  /** Zones to draw. The first frames the camera when no centre is given. */
  geometries?: { id: string; geometry: Geometry; muted?: boolean }[];
  center?: LatLng | null;
  zoom?: number;
  userLocation?: LatLng | null;
  /** Off for thumbnails and previews. */
  interactive?: boolean;
  onPress?: (point: LatLng) => void;
  /** Kept in a ref so the map isn't re-rendered just to recentre it. */
  controlRef?: React.MutableRefObject<ZoneMapHandle | null>;
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
  controlRef,
  style,
  children,
}: ZoneMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const zoomRef = useRef(zoom);

  const cameraCenter =
    center ?? (geometries[0] ? geometryCenter(geometries[0].geometry) : null) ?? userLocation;

  useEffect(() => {
    if (!controlRef) return;

    controlRef.current = {
      flyTo: (point, nextZoom) => {
        zoomRef.current = nextZoom ?? zoomRef.current;
        cameraRef.current?.flyTo({
          center: toLngLat(point),
          zoom: zoomRef.current,
          duration: 700,
        });
      },
      zoomBy: (delta) => {
        zoomRef.current = Math.min(20, Math.max(2, zoomRef.current + delta));
        cameraRef.current?.zoomTo(zoomRef.current, { duration: 250 });
      },
    };
  }, [controlRef]);

  return (
    <View style={[styles.map, style]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={SYPAU_MAP_STYLE}
        logo={false}
        attribution={false}
        compass={false}
        scaleBar={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={false}
        touchPitch={false}
        onPress={
          onPress
            ? (event) => {
                const [longitude, latitude] = event.nativeEvent.lngLat;
                onPress({ latitude, longitude });
              }
            : undefined
        }>
        <Camera
          ref={cameraRef}
          initialViewState={
            cameraCenter ? { center: toLngLat(cameraCenter), zoom } : { zoom }
          }
        />

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
      </Map>
    </View>
  );
}

/** Live position: a cyan dot with a soft halo, as in the debug reference. */
export function UserMarker({ point }: { point: LatLng }) {
  return (
    <Marker lngLat={toLngLat(point)} anchor="center">
      <View style={styles.userHalo}>
        <View style={styles.userDot} />
      </View>
    </Marker>
  );
}

/** Editable vertex handle used by the boundary editor. */
export function VertexHandle({
  point,
  selected = false,
  onPress,
}: {
  point: LatLng;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Marker lngLat={toLngLat(point)} anchor="center">
      <View
        onTouchEnd={onPress}
        style={[styles.vertex, selected && styles.vertexSelected]}
      />
    </Marker>
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
  vertexSelected: {
    borderColor: SypauColor.red,
    transform: [{ scale: 1.25 }],
  },
});
