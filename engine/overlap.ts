import { geometryArea, geometryContainsPoint, type LatLng } from '@/engine/geo';
import type { Fold } from '@/types/fold';

/** Folds whose geometry currently contains `point`. */
export function activeFoldSet(point: LatLng, folds: Fold[], bufferMeters = 0): Fold[] {
  return folds.filter((fold) => fold.enabled && geometryContainsPoint(point, fold.geometry, bufferMeters));
}

/**
 * Resolve a single fold from the active set: highest priority wins,
 * ties broken by smaller area, then most recently updated.
 */
export function resolveFold(candidates: Fold[]): Fold | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  return [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;

    const areaDiff = geometryArea(a.geometry) - geometryArea(b.geometry);
    if (areaDiff !== 0) return areaDiff;

    return b.updatedAt - a.updatedAt;
  })[0];
}
