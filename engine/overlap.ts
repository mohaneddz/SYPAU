import { geometryArea, geometryContainsPoint, type LatLng } from '@/engine/geo';
import type { Zone } from '@/types/zone';

/** Enabled zones whose geometry currently contains `point`. */
export function activeZoneSet(point: LatLng, zones: Zone[], bufferMeters = 0): Zone[] {
  return zones.filter(
    (zone) => zone.enabled && geometryContainsPoint(point, zone.geometry, bufferMeters)
  );
}

/**
 * Pick the one zone that owns the device right now: highest priority wins.
 *
 * Ties break to the smaller zone, on the assumption that a zone drawn inside
 * another is the more specific intent (a bedroom inside a house), then to the
 * most recently edited so the user's latest change takes effect.
 */
export function resolveZone(candidates: Zone[]): Zone | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  return [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;

    const areaDiff = geometryArea(a.geometry) - geometryArea(b.geometry);
    if (areaDiff !== 0) return areaDiff;

    return b.updatedAt - a.updatedAt;
  })[0];
}
