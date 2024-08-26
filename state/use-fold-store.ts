import { create } from 'zustand';

import type { LatLng } from '@/engine/geo';
import type { EdgeColor, Fold, ProfileKey } from '@/types/fold';

type NewFold = {
  name: string;
  geometryJson: LatLng[];
  profileKey?: ProfileKey;
  edgeColor?: EdgeColor;
  priority?: number;
};

type FoldStore = {
  folds: Fold[];
  addFold: (fold: NewFold) => Fold;
  removeFold: (id: string) => void;
  toggleFold: (id: string) => void;
  updateFold: (id: string, patch: Partial<Omit<Fold, 'id' | 'createdAt'>>) => void;
};

function generateId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `fold_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useFoldStore = create<FoldStore>((set) => ({
  folds: [],

  addFold: (fold) => {
    const now = Date.now();
    const created: Fold = {
      id: generateId(),
      name: fold.name,
      edgeColor: fold.edgeColor ?? 'cyan',
      enabled: true,
      priority: fold.priority ?? 5,
      geometryType: 'polygon',
      geometryJson: fold.geometryJson,
      profileKey: fold.profileKey ?? 'custom',
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ folds: [...state.folds, created] }));
    return created;
  },

  removeFold: (id) => set((state) => ({ folds: state.folds.filter((f) => f.id !== id) })),

  toggleFold: (id) =>
    set((state) => ({
      folds: state.folds.map((f) => (f.id === id ? { ...f, enabled: !f.enabled, updatedAt: Date.now() } : f)),
    })),

  updateFold: (id, patch) =>
    set((state) => ({
      folds: state.folds.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: Date.now() } : f)),
    })),
}));
