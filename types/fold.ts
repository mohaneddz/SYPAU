import type { LatLng } from '@/engine/geo';

export type ProfileKey =
  | 'school'
  | 'studying'
  | 'sleeping'
  | 'awake'
  | 'tired'
  | 'praying'
  | 'silent'
  | 'custom';

export type EdgeColor = 'cyan' | 'violet' | 'amber';

export type Fold = {
  id: string;
  name: string;
  edgeColor: EdgeColor;
  enabled: boolean;
  priority: number;
  geometryType: 'polygon';
  geometryJson: LatLng[];
  profileKey: ProfileKey;
  createdAt: number;
  updatedAt: number;
};
