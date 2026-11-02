import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SypauText } from '@/components/sypau/text';
import { SYPAU_MAP_STYLE } from '@/constants/map-style';
import { SypauColor } from '@/constants/sypau';
import { circlePolygonPoints, type Geometry, type LatLng } from '@/engine/geo';
import { centroidOf } from '@/utils/geometry';
import { boundsOf, pointsToLngLatRing, toLngLat } from '@/utils/map-geo';

/** A zone's outline as a closed ring, whatever shape it was drawn as. */
export function geometryToRing(geometry: Geometry): LatLng[] {
  if (geometry.type === 'circle') {
    return circlePolygonPoints(geometry.center, geometry.radiusMeters, 64);
  }
  return geometry.points;
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
  /** Frames every zone on the map, e.g. after the list changes. */
  fitAll: () => void;
  /** Frames just these shapes, e.g. the zone picked from a list. */
  fitTo: (geometries: Geometry[]) => void;
};

type ZoneMapProps = {
  /** Zones to draw. Together they frame the camera when no centre is given. */
  geometries?: { id: string; geometry: Geometry; muted?: boolean; label?: string }[];
  center?: LatLng | null;
  zoom?: number;
  userLocation?: LatLng | null;
  /** Off for thumbnails and previews. */
  interactive?: boolean;
  onPress?: (point: LatLng) => void;
  /** Kept in a ref so the map isn't re-rendered just to recentre it. */
  controlRef?: React.MutableRefObject<ZoneMapHandle | null>;
  /**
   * Inset, in points, between the zones and the map edge when the camera frames
   * them. Thumbnails want the shape to fill the frame; full maps want room for
   * the controls laid over them.
   */
  fitPadding?: number;
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
  fitPadding = 18,
  style,
  children,
}: ZoneMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const zoomRef = useRef(zoom);

  // A fixed zoom frames a 100 m zone and a 3 km one identically, so one is a
  // speck and the other overflows. Framing by bounds gives every zone its frame.
  const bounds = useMemo(
    () => (center ? null : boundsOf(geometries.map((entry) => entry.geometry))),
    [center, geometries]
  );
  const padding = useMemo(
    () => ({ top: fitPadding, right: fitPadding, bottom: fitPadding, left: fitPadding }),
    [fitPadding]
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const cameraCenter = center ?? userLocation;

  // Tiles come over the network, and until the first full render the map is a
  // flat black panel that reads as broken. The timeout covers a render event
  // that never comes (offline, or a tile that fails).
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

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
      fitAll: () => {
        if (!boundsRef.current) return;
        cameraRef.current?.fitBounds(boundsRef.current, { padding, duration: 600 });
      },
      fitTo: (shapes) => {
        const target = boundsOf(shapes);
        if (!target) return;
        cameraRef.current?.fitBounds(target, { padding, duration: 600 });
      },
    };
  }, [controlRef, padding]);

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
        onDidFinishRenderingMapFully={() => setLoaded(true)}
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
          maxZoom={19}
          initialViewState={
            bounds
              ? { bounds, padding }
              : cameraCenter
                ? { center: toLngLat(cameraCenter), zoom }
                : { zoom }
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

        <ZoneLabels geometries={geometries} />

        {userLocation ? <UserMarker point={userLocation} /> : null}

        {children}
      </Map>

      {/* Thumbnails are too small for a label; they just fill in. */}
      {!loaded && interactive ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={SypauColor.cyan} />
          <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
            Loading map
          </SypauText>
        </View>
      ) : null}
    </View>
  );
}

const MAP_LOAD_TIMEOUT_MS = 10_000;

/**
 * Zone names drawn by the map itself rather than as React markers, so they
 * stay pinned through pans and zooms and give way to each other on collision.
 */
function ZoneLabels({ geometries }: { geometries: ZoneMapProps['geometries'] }) {
  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (geometries ?? [])
        .filter((entry) => entry.label)
        .map((entry) => {
          const center =
            entry.geometry.type === 'circle'
              ? entry.geometry.center
              : (centroidOf(entry.geometry.points) ?? entry.geometry.points[0]);
          return {
            type: 'Feature',
            properties: { name: entry.label!.toUpperCase(), muted: entry.muted ? 1 : 0 },
            geometry: { type: 'Point', coordinates: toLngLat(center) },
          };
        }),
    }),
    [geometries]
  );

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="zoneLabels" data={data}>
      <Layer
        id="zoneLabelText"
        type="symbol"
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
          'text-letter-spacing': 0.12,
          'text-offset': [0, 1.6],
        }}
        paint={{
          'text-color': ['case', ['==', ['get', 'muted'], 1], SypauColor.boneFaint, SypauColor.bone],
          'text-halo-color': SypauColor.ink,
          'text-halo-width': 1.6,
        }}
      />
    </GeoJSONSource>
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
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
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
