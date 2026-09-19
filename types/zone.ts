import type { Geometry } from '@/engine/geo';

export type BoundaryType = 'polygon' | 'radius' | 'freehand';

export type ZoneIcon =
  | 'home'
  | 'school'
  | 'book'
  | 'briefcase'
  | 'dumbbell'
  | 'moon'
  | 'coffee'
  | 'pin';

export const ZONE_ICONS: ZoneIcon[] = [
  'home',
  'school',
  'book',
  'briefcase',
  'dumbbell',
  'moon',
  'coffee',
  'pin',
];

/** What should happen once the user leaves this zone. */
export type ExitBehavior =
  | 'restorePrevious'
  | 'defaultProfile'
  | 'specificProfile'
  | 'nothing';

export type Zone = {
  id: string;
  name: string;
  icon: ZoneIcon;
  enabled: boolean;
  boundaryType: BoundaryType;
  /** Freehand is stored simplified, as a polygon. */
  geometry: Geometry;
  profileId: string;
  exitBehavior: ExitBehavior;
  exitProfileId: string | null;
  /** Higher wins when zones overlap. */
  priority: number;
  /** Dwell gating, so a drive-past doesn't trip the zone. */
  activationDelaySeconds: number;
  exitDelaySeconds: number;
  createdAt: number;
  updatedAt: number;
  lastEnteredAt: number | null;
  lastExitedAt: number | null;
};

/** Live per-zone state the UI reads; derived, never persisted. */
export type ZoneRuntimeState = {
  zoneId: string;
  isInside: boolean;
  /** Metres to the boundary. 0 when inside. */
  distanceMeters: number;
  /** True once inside but still waiting out activationDelaySeconds. */
  isDwelling: boolean;
};
