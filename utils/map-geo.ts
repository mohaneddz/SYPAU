import type { LatLng } from '@/engine/geo';

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
