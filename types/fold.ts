import type { LatLng } from '@/engine/geo';

export type IconType =
  | 'school'
  | 'studying'
  | 'sleeping'
  | 'awake'
  | 'tired'
  | 'praying'
  | 'custom';

export type EdgeColor = 'cyan' | 'violet' | 'amber';

export type Geometry =
  | { type: 'polygon'; points: LatLng[] }
  | { type: 'circle'; center: LatLng; radiusMeters: number };

export type Fold = {
  id: string;
  name: string;
  iconType: IconType;
  edgeColor: EdgeColor;
  enabled: boolean;
  priority: number;
  geometry: Geometry;
  profileId: string;
  dwellEnterMs: number;
  dwellExitMs: number;
  restoreOnExit: boolean;
  createdAt: number;
  updatedAt: number;
};
