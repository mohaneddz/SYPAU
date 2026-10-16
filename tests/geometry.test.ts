import {
  circlePolygonPoints,
  distanceToEdge,
  distanceToGeometry,
  geometryArea,
  geometryContainsPoint,
  haversineDistance,
  polygonArea,
  polygonContainsPoint,
  type LatLng,
} from '@/engine/geo';
import { geometriesOverlap, simplifyPath } from '@/utils/geometry';
import { boundsOf } from '@/utils/map-geo';

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

describe('distanceToEdge', () => {
  it('measures to the border from inside a polygon instead of returning zero', () => {
    // The origin sits ~100 m from each side of the square.
    const distance = distanceToEdge(ORIGIN, { type: 'polygon', points: SQUARE });
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(120);
  });

  it('measures to a circle edge from inside', () => {
    const geometry = { type: 'circle' as const, center: ORIGIN, radiusMeters: 100 };
    expect(distanceToEdge(ORIGIN, geometry)).toBeCloseTo(100, 0);
  });
});

describe('boundsOf', () => {
  it('is null with nothing to frame', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('frames a polygon by its extreme points, as [west, south, east, north]', () => {
    expect(boundsOf([{ type: 'polygon', points: SQUARE }])).toEqual([3.0577, 36.7529, 3.0599, 36.7547]);
  });

  it('frames a circle by its edge rather than its centre', () => {
    const [west, south, east, north] = boundsOf([
      { type: 'circle', center: ORIGIN, radiusMeters: 1000 },
    ])!;
    expect(haversineDistance({ latitude: south, longitude: ORIGIN.longitude }, ORIGIN)).toBeCloseTo(1000, -1);
    expect(haversineDistance({ latitude: north, longitude: ORIGIN.longitude }, ORIGIN)).toBeCloseTo(1000, -1);
    expect(haversineDistance({ latitude: ORIGIN.latitude, longitude: west }, ORIGIN)).toBeCloseTo(1000, -1);
    expect(haversineDistance({ latitude: ORIGIN.latitude, longitude: east }, ORIGIN)).toBeCloseTo(1000, -1);
  });
});

describe('geometriesOverlap', () => {
  const square = { type: 'polygon' as const, points: SQUARE };
  const shifted = (dLng: number) => ({
    type: 'polygon' as const,
    points: SQUARE.map((p) => ({ latitude: p.latitude, longitude: p.longitude + dLng })),
  });

  it('spots two polygons sharing ground', () => {
    expect(geometriesOverlap(square, shifted(0.001))).toBe(true);
  });

  it('leaves apart polygons apart', () => {
    expect(geometriesOverlap(square, shifted(0.01))).toBe(false);
  });

  it('counts a zone nested wholly inside another', () => {
    const inner = { type: 'circle' as const, center: ORIGIN, radiusMeters: 20 };
    expect(geometriesOverlap(square, inner)).toBe(true);
    expect(geometriesOverlap(inner, square)).toBe(true);
  });

  it('catches a cross shape where no vertex is inside the other', () => {
    const wide = {
      type: 'polygon' as const,
      points: [
        { latitude: 36.7536, longitude: 3.0560 },
        { latitude: 36.7540, longitude: 3.0560 },
        { latitude: 36.7540, longitude: 3.0616 },
        { latitude: 36.7536, longitude: 3.0616 },
      ],
    };
    const tall = {
      type: 'polygon' as const,
      points: [
        { latitude: 36.7520, longitude: 3.0586 },
        { latitude: 36.7556, longitude: 3.0586 },
        { latitude: 36.7556, longitude: 3.0590 },
        { latitude: 36.7520, longitude: 3.0590 },
      ],
    };
    expect(geometriesOverlap(wide, tall)).toBe(true);
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
