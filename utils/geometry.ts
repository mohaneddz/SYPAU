import { haversineDistance, type LatLng } from '@/engine/geo';

/**
 * Ramer-Douglas-Peucker simplification.
 *
 * A freehand drag produces a point per touch event — hundreds for one
 * boundary. Storing and hit-testing all of them is wasteful, and the extra
 * points carry no intent, so the path is reduced before it's saved.
 */
export function simplifyPath(points: LatLng[], toleranceMeters = 8): LatLng[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= toleranceMeters) return [first, last];

  const left = simplifyPath(points.slice(0, index + 1), toleranceMeters);
  const right = simplifyPath(points.slice(index), toleranceMeters);

  // The split point appears in both halves.
  return [...left.slice(0, -1), ...right];
}

/** Distance from `point` to the line through `a` and `b`, in metres. */
function perpendicularDistance(point: LatLng, a: LatLng, b: LatLng): number {
  const abLat = b.latitude - a.latitude;
  const abLng = b.longitude - a.longitude;
  const lengthSquared = abLat * abLat + abLng * abLng;

  if (lengthSquared === 0) return haversineDistance(point, a);

  let t =
    ((point.latitude - a.latitude) * abLat + (point.longitude - a.longitude) * abLng) /
    lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return haversineDistance(point, {
    latitude: a.latitude + t * abLat,
    longitude: a.longitude + t * abLng,
  });
}

/** Centre of a set of points, for framing a zone on the map. */
export function centroidOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;

  const sum = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

/** Smallest circle that covers `points`, used to register polygons as fences. */
export function boundingCircle(points: LatLng[]): { center: LatLng; radiusMeters: number } | null {
  const center = centroidOf(points);
  if (!center) return null;

  const radiusMeters = points.reduce(
    (max, point) => Math.max(max, haversineDistance(center, point)),
    0
  );

  return { center, radiusMeters };
}

/**
 * Human-readable area: m² below a hectare, km² above. Kept short enough to sit
 * on one line of a half-width card — "248,792 m²" doesn't, "0.25 km²" does.
 */
export function formatArea(squareMeters: number): string {
  if (squareMeters < 10_000) return `${Math.round(squareMeters).toLocaleString()} m²`;
  const km = squareMeters / 1_000_000;
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km²`;
}

/** Human-readable distance: metres below a kilometre, km above. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
