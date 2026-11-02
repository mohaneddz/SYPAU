import { Marker } from '@maplibre/maplibre-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SypauIcon } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { VertexHandle, ZoneMap, type ZoneMapHandle } from '@/components/sypau/zoneMap';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import type { Geometry, LatLng } from '@/engine/geo';
import { centroidOf, simplifyPath } from '@/utils/geometry';
import { toLngLat } from '@/utils/map-geo';
import type { BoundaryType } from '@/types/zone';

export type BoundaryDraft =
  | { type: 'polygon'; points: LatLng[] }
  | { type: 'radius'; center: LatLng | null; radiusMeters: number }
  | { type: 'freehand'; points: LatLng[] };

export function draftToGeometry(draft: BoundaryDraft): Geometry | null {
  if (draft.type === 'radius') {
    if (!draft.center) return null;
    return { type: 'circle', center: draft.center, radiusMeters: draft.radiusMeters };
  }

  if (draft.points.length < 3) return null;
  return { type: 'polygon', points: draft.points };
}

export function geometryToDraft(geometry: Geometry, boundaryType: BoundaryType): BoundaryDraft {
  if (geometry.type === 'circle') {
    return { type: 'radius', center: geometry.center, radiusMeters: geometry.radiusMeters };
  }
  return boundaryType === 'freehand'
    ? { type: 'freehand', points: geometry.points }
    : { type: 'polygon', points: geometry.points };
}

type BoundaryEditorProps = {
  draft: BoundaryDraft;
  onChange: (draft: BoundaryDraft) => void;
  userLocation: LatLng | null;
  /** Height of whatever is laid over the map's top edge, e.g. a header. */
  topInset?: number;
  style?: object;
};

/**
 * The map half of the create/edit screen.
 *
 * Polygon taps place vertices, radius places a centre, and freehand traces a
 * path that's simplified before it becomes a boundary — a drag produces a point
 * per touch event, and none of the extra ones carry intent.
 */
export function BoundaryEditor({
  draft,
  onChange,
  userLocation,
  topInset = SypauSpace.lg,
  style,
}: BoundaryEditorProps) {
  const mapControl = useRef<ZoneMapHandle | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [tracing, setTracing] = useState(false);
  // Taps arrive faster than renders, so they read the latest draft from here.
  // The draft is the only copy of the points: a separate trace buffer used to
  // survive undo and clear, and the next tap brought the old points back.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const geometry = draftToGeometry(draft);

  const handleMapPress = useCallback(
    async (point: LatLng, screen: [number, number]) => {
      const current = draftRef.current;

      if (current.type === 'radius') {
        Haptics.selectionAsync().catch(() => {});
        onChange({ ...current, center: point });
        return;
      }

      // A picked point waits for this tap to say where it goes.
      if (selectedVertex !== null) {
        Haptics.selectionAsync().catch(() => {});
        const points = [...current.points];
        points[selectedVertex] = point;
        onChange({ ...current, points });
        setSelectedVertex(null);
        return;
      }

      // While tracing every tap is a new point, even one landing on an old dot.
      if (!tracing) {
        const hit = await nearestVertex(current.points, screen, mapControl.current);
        if (hit !== null) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setSelectedVertex(hit);
          return;
        }
      }

      if (current.type === 'polygon' || tracing) {
        Haptics.selectionAsync().catch(() => {});
        onChange({ ...current, points: [...current.points, point] });
      }
    },
    [onChange, selectedVertex, tracing]
  );

  const finishTrace = () => {
    setTracing(false);
    // Simplified on commit rather than per tap, so undo while tracing still
    // steps back through the points the user actually placed.
    const current = draftRef.current;
    if (current.type === 'freehand' && current.points.length >= 3) {
      onChange({ type: 'freehand', points: simplifyPath(current.points, 10) });
    }
  };

  const undo = () => {
    setSelectedVertex(null);
    if (draft.type === 'radius') {
      onChange({ ...draft, center: null });
      return;
    }
    onChange({ ...draft, points: draft.points.slice(0, -1) });
  };

  const clear = () => {
    setSelectedVertex(null);
    if (draft.type === 'radius') {
      onChange({ ...draft, center: null });
      return;
    }
    onChange({ ...draft, points: [] });
  };

  const pointCount = draft.type === 'radius' ? (draft.center ? 1 : 0) : draft.points.length;

  return (
    <View style={[styles.wrap, style]}>
      <View style={StyleSheet.absoluteFill}>
        <ZoneMap
          geometries={geometry ? [{ id: 'draft', geometry }] : []}
          userLocation={userLocation}
          center={userLocation}
          controlRef={mapControl}
          onPress={handleMapPress}
          style={StyleSheet.absoluteFill}>
          {draft.type !== 'radius'
            ? draft.points.map((point, index) => (
                <VertexHandle
                  key={`${point.latitude},${point.longitude},${index}`}
                  point={point}
                  selected={selectedVertex === index}
                />
              ))
            : null}

          {draft.type === 'radius' && draft.center ? (
            <VertexHandle point={draft.center} />
          ) : null}

          {/* The pin at the heart of the shape, as in the reference. */}
          {geometry && geometry.type === 'polygon' ? (
            <Marker lngLat={toLngLat(centroidOf(geometry.points) ?? geometry.points[0])} anchor="bottom">
              <View pointerEvents="none" style={styles.centerPin}>
                <SypauIcon name="pin" size={30} color={SypauColor.ink} />
              </View>
            </Marker>
          ) : null}
        </ZoneMap>
      </View>

      {/* Map controls, per the create-zone reference. */}
      <View style={[styles.mapControls, { top: topInset + SypauSpace.xxl * 2 }]}>
        <MapButton
          icon="locate"
          label="Recentre"
          onPress={() => userLocation && mapControl.current?.flyTo(userLocation, 15)}
        />
        <MapButton icon="plus" label="Zoom in" onPress={() => mapControl.current?.zoomBy(1)} />
        <MapButton icon="minus" label="Zoom out" onPress={() => mapControl.current?.zoomBy(-1)} />
      </View>

      <View style={styles.editControls}>
        {selectedVertex !== null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedVertex(null)}
            style={[styles.editButton, styles.editButtonActive]}>
            <SypauIcon name="close" size={16} color={SypauColor.paperInk} />
            <SypauText variant="labelSm" caps color={SypauColor.paperInk}>
              Cancel move
            </SypauText>
          </Pressable>
        ) : null}

        {selectedVertex === null && draft.type === 'freehand' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (tracing) {
                finishTrace();
                return;
              }
              setSelectedVertex(null);
              setTracing(true);
            }}
            style={[styles.editButton, tracing && styles.editButtonActive]}>
            <SypauIcon
              name="freehand"
              size={16}
              color={tracing ? SypauColor.paperInk : SypauColor.bone}
            />
            <SypauText
              variant="labelSm"
              caps
              color={tracing ? SypauColor.paperInk : SypauColor.bone}>
              {tracing ? 'Tracing' : 'Trace'}
            </SypauText>
          </Pressable>
        ) : null}

        {selectedVertex === null && pointCount > 0 ? (
          <>
            <Pressable accessibilityRole="button" onPress={undo} style={styles.editButton}>
              <SypauIcon name="undo" size={16} />
              <SypauText variant="labelSm" caps>
                Undo
              </SypauText>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={clear} style={styles.editButton}>
              <SypauIcon name="close" size={16} color={SypauColor.red} />
              <SypauText variant="labelSm" caps color={SypauColor.red}>
                Clear
              </SypauText>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={[styles.hint, { top: topInset + SypauSpace.sm }]}>
        <SypauText variant="labelSm" caps color={SypauColor.cyan}>
          {hintFor(draft, tracing, selectedVertex)}
        </SypauText>
      </View>
    </View>
  );
}

function hintFor(draft: BoundaryDraft, tracing: boolean, selectedVertex: number | null): string {
  if (draft.type === 'radius') {
    return draft.center ? 'Tap to move it · set the radius below' : 'Tap the map to place the centre';
  }
  if (selectedVertex !== null) return `Tap where point ${selectedVertex + 1} should go`;
  if (draft.type === 'freehand') {
    if (tracing) return 'Tap along your boundary, then stop tracing';
    return draft.points.length >= 3
      ? `${draft.points.length} points — tap one to move it`
      : 'Start tracing to draw';
  }
  if (draft.points.length < 3) return `Tap to place points — ${3 - draft.points.length} more`;
  return `${draft.points.length} points — tap one to move it`;
}

/** How close a tap must land to a dot to pick it up: about a fingertip. */
const VERTEX_HIT_RADIUS = 28;

async function nearestVertex(
  points: LatLng[],
  screen: [number, number],
  map: ZoneMapHandle | null
): Promise<number | null> {
  if (!map || points.length === 0) return null;

  const projected = await Promise.all(points.map((point) => map.project(point)));
  let best: number | null = null;
  let bestDistance = VERTEX_HIT_RADIUS;
  projected.forEach((position, index) => {
    if (!position) return;
    const distance = Math.hypot(position[0] - screen[0], position[1] - screen[1]);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function MapButton({
  icon,
  label,
  onPress,
}: {
  icon: 'locate' | 'plus' | 'minus';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
      <SypauIcon name={icon} size={22} color={SypauColor.paperInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: SypauColor.surface },
  mapControls: {
    position: 'absolute',
    right: SypauSpace.lg,
    gap: SypauSpace.md,
  },
  centerPin: { alignItems: 'center' },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editControls: {
    position: 'absolute',
    left: SypauSpace.lg,
    // Clears the form sheet that overlaps the map's lower edge.
    bottom: SypauSpace.xl + SypauSpace.md,
    flexDirection: 'row',
    gap: SypauSpace.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.xs,
    backgroundColor: 'rgba(13,13,13,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.pill,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },
  editButtonActive: { backgroundColor: SypauColor.cyan, borderColor: SypauColor.cyan },
  hint: {
    position: 'absolute',
    left: SypauSpace.lg,
    backgroundColor: 'rgba(13,13,13,0.88)',
    borderRadius: SypauRadius.pill,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },
  pressed: { opacity: 0.8 },
});
