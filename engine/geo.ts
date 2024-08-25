export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in meters. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is `point` within `radius` (+ optional buffer) meters of `center`. */
export function circleContainsPoint(
  point: LatLng,
  center: LatLng,
  radius: number,
  bufferMeters = 0
): boolean {
  return haversineDistance(point, center) <= radius + bufferMeters;
}

/**
 * Ray-casting point-in-polygon test, treating lat/lng as planar.
 * Fine for the small, local-scale zones Folds are drawn at.
 */
export function polygonContainsPoint(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Approximate polygon-containment with a meter buffer: also treats points
 * just outside the border (within `bufferMeters` of the nearest edge) as inside.
 * Used for hysteresis so GPS jitter near a border doesn't flicker enter/exit.
 */
export function polygonContainsPointWithBuffer(
  point: LatLng,
  polygon: LatLng[],
  bufferMeters = 0
): boolean {
  if (polygonContainsPoint(point, polygon)) return true;
  if (bufferMeters <= 0 || polygon.length < 2) return false;
  return distanceToPolygonBorder(point, polygon) <= bufferMeters;
}

function distanceToPolygonBorder(point: LatLng, polygon: LatLng[]): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    min = Math.min(min, distanceToSegment(point, polygon[j], polygon[i]));
  }
  return min;
}

/** Approximate distance from a point to a segment, in meters (planar approximation). */
function distanceToSegment(point: LatLng, a: LatLng, b: LatLng): number {
  const abLat = b.latitude - a.latitude;
  const abLng = b.longitude - a.longitude;
  const lenSq = abLat * abLat + abLng * abLng;

  let t = lenSq === 0 ? 0 : ((point.latitude - a.latitude) * abLat + (point.longitude - a.longitude) * abLng) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest: LatLng = {
    latitude: a.latitude + t * abLat,
    longitude: a.longitude + t * abLng,
  };
  return haversineDistance(point, closest);
}

/** Rough planar area of a polygon in square meters (shoelace formula with local meter conversion). */
export function polygonArea(polygon: LatLng[]): number {
  if (polygon.length < 3) return 0;

  const originLat = toRadians(polygon[0].latitude);
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(originLat);

  const pts = polygon.map((p) => ({
    x: p.longitude * metersPerDegLng,
    y: p.latitude * metersPerDegLat,
  }));

  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return Math.abs(area / 2);
}
