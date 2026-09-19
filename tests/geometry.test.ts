import {
  circlePolygonPoints,
  distanceToGeometry,
  geometryArea,
  geometryContainsPoint,
  haversineDistance,
  polygonArea,
  polygonContainsPoint,
  type LatLng,
} from '@/engine/geo';
import { simplifyPath } from '@/utils/geometry';

const ORIGIN: LatLng = { latitude: 36.7538, longitude: 3.0588 };

// A ~200 m square around the origin.
const SQUARE: LatLng[] = [
  { latitude: 36.7529, longitude: 3.0577 },
  { latitude: 36.7547, longitude: 3.0577 },
  { latitude: 36.7547, longitude: 3.0599 },
  { latitude: 36.7529, longitude: 3.0599 },
];

describe('haversineDistance', () => {
  it('is zero for a point against itself', () => {
    expect(haversineDistance(ORIGIN, ORIGIN)).toBe(0);
  });

  it('measures a known north-south offset', () => {
    // 0.0009 degrees of latitude is almost exactly 100 m.
    const north = { latitude: ORIGIN.latitude + 0.0009, longitude: ORIGIN.longitude };
    expect(haversineDistance(ORIGIN, north)).toBeGreaterThan(95);
    expect(haversineDistance(ORIGIN, north)).toBeLessThan(105);
  });

  it('is symmetric', () => {
    const other = { latitude: 36.76, longitude: 3.07 };
    expect(haversineDistance(ORIGIN, other)).toBeCloseTo(haversineDistance(other, ORIGIN), 6);
  });
});

describe('polygonContainsPoint', () => {
  it('finds a point inside', () => {
    expect(polygonContainsPoint(ORIGIN, SQUARE)).toBe(true);
  });

  it('rejects a point outside', () => {
    expect(polygonContainsPoint({ latitude: 36.76, longitude: 3.07 }, SQUARE)).toBe(false);
  });

  it('rejects a degenerate polygon', () => {
    expect(polygonContainsPoint(ORIGIN, SQUARE.slice(0, 2))).toBe(false);
  });
});

describe('geometryContainsPoint', () => {
  it('respects a circle radius', () => {
    const geometry = { type: 'circle' as const, center: ORIGIN, radiusMeters: 100 };
    const near = { latitude: ORIGIN.latitude + 0.0005, longitude: ORIGIN.longitude };
    const far = { latitude: ORIGIN.latitude + 0.002, longitude: ORIGIN.longitude };

    expect(geometryContainsPoint(near, geometry)).toBe(true);
    expect(geometryContainsPoint(far, geometry)).toBe(false);
  });

  it('treats a point just outside as inside when given a buffer', () => {
    const geometry = { type: 'circle' as const, center: ORIGIN, radiusMeters: 100 };
    // ~111 m out: outside the radius, inside a 25 m hysteresis buffer.
    const justOutside = { latitude: ORIGIN.latitude + 0.001, longitude: ORIGIN.longitude };

    expect(geometryContainsPoint(justOutside, geometry)).toBe(false);
    expect(geometryContainsPoint(justOutside, geometry, 25)).toBe(true);
  });

  it('applies the buffer to polygons too', () => {
    const geometry = { type: 'polygon' as const, points: SQUARE };
    const justOutside = { latitude: 36.7548, longitude: 3.0588 };

    expect(geometryContainsPoint(justOutside, geometry)).toBe(false);
    expect(geometryContainsPoint(justOutside, geometry, 30)).toBe(true);
  });
});

describe('distanceToGeometry', () => {
  it('is zero inside', () => {
    expect(distanceToGeometry(ORIGIN, { type: 'polygon', points: SQUARE })).toBe(0);
  });

  it('measures out from a circle edge, not its centre', () => {
    const geometry = { type: 'circle' as const, center: ORIGIN, radiusMeters: 100 };
    const far = { latitude: ORIGIN.latitude + 0.0018, longitude: ORIGIN.longitude };

    // ~200 m from the centre, so ~100 m from the boundary.
    expect(distanceToGeometry(far, geometry)).toBeGreaterThan(90);
    expect(distanceToGeometry(far, geometry)).toBeLessThan(110);
  });
});

describe('area', () => {
  it('computes a circle area from its radius', () => {
    const area = geometryArea({ type: 'circle', center: ORIGIN, radiusMeters: 100 });
    expect(area).toBeCloseTo(Math.PI * 10_000, 0);
  });

  it('computes a polygon area independent of winding direction', () => {
    expect(polygonArea(SQUARE)).toBeCloseTo(polygonArea([...SQUARE].reverse()), 0);
  });

  it('is zero for a degenerate polygon', () => {
    expect(polygonArea(SQUARE.slice(0, 2))).toBe(0);
  });
});

describe('circlePolygonPoints', () => {
  it('returns a ring roughly one radius from the centre', () => {
    const points = circlePolygonPoints(ORIGIN, 100, 16);
    expect(points).toHaveLength(16);

    for (const point of points) {
      expect(haversineDistance(ORIGIN, point)).toBeGreaterThan(95);
      expect(haversineDistance(ORIGIN, point)).toBeLessThan(105);
    }
  });
});

describe('simplifyPath', () => {
  it('drops points that sit on a straight line', () => {
    const line: LatLng[] = [
      { latitude: 36.75, longitude: 3.05 },
      { latitude: 36.751, longitude: 3.05 },
      { latitude: 36.752, longitude: 3.05 },
      { latitude: 36.753, longitude: 3.05 },
    ];

    expect(simplifyPath(line, 5)).toHaveLength(2);
  });

  it('keeps corners', () => {
    const corner: LatLng[] = [
      { latitude: 36.75, longitude: 3.05 },
      { latitude: 36.752, longitude: 3.05 },
      { latitude: 36.752, longitude: 3.053 },
    ];

    expect(simplifyPath(corner, 5)).toHaveLength(3);
  });

  it('passes short paths through untouched', () => {
    const pair = SQUARE.slice(0, 2);
    expect(simplifyPath(pair, 5)).toEqual(pair);
  });
});
