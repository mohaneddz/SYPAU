import type { Geometry, LatLng } from '@/engine/geo';

/** MapLibre/GeoJSON coordinates are `[longitude, latitude]`, unlike the app's `{latitude, longitude}`. */
export type LngLat = [longitude: number, latitude: number];

export function toLngLat(point: LatLng): LngLat {
  return [point.longitude, point.latitude];
}

export function fromLngLat(point: LngLat): LatLng {
  return { longitude: point[0], latitude: point[1] };
}

export function pointsToLngLatRing(points: LatLng[]): LngLat[] {
  const ring = points.map(toLngLat);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push(first);
  }
  return ring;
}

/** `[west, south, east, north]`, the box MapLibre frames a camera on. */
export type LngLatBox = [west: number, south: number, east: number, north: number];

const METERS_PER_DEGREE_LATITUDE = 111_320;

/**
 * The box that covers every geometry. Circles are expanded by their radius, so
 * a radius zone is framed by its edge rather than its centre pin.
 */
export function boundsOf(geometries: Geometry[]): LngLatBox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const include = (point: LatLng, padMeters = 0) => {
    const dLat = padMeters / METERS_PER_DEGREE_LATITUDE;
    const cosLat = Math.max(0.01, Math.cos((point.latitude * Math.PI) / 180));
    const dLng = padMeters / (METERS_PER_DEGREE_LATITUDE * cosLat);
    west = Math.min(west, point.longitude - dLng);
    east = Math.max(east, point.longitude + dLng);
    south = Math.min(south, point.latitude - dLat);
    north = Math.max(north, point.latitude + dLat);
  };

  for (const geometry of geometries) {
    if (geometry.type === 'circle') include(geometry.center, geometry.radiusMeters);
    else geometry.points.forEach((point) => include(point));
  }

  if (!Number.isFinite(west)) return null;
  return [west, south, east, north];
}
