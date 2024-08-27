import { create } from 'zustand';

import { getDb } from '@/db/client';
import { deleteFold, insertFold, listFolds, updateFold as updateFoldRow } from '@/db/queries';
import type { Geometry } from '@/engine/geo';
import type { EdgeColor, Fold, IconType } from '@/types/fold';

type NewFold = {
  name: string;
  geometry: Geometry;
  profileId: string;
  iconType?: IconType;
  edgeColor?: EdgeColor;
  priority?: number;
  dwellEnterMs?: number;
  dwellExitMs?: number;
  restoreOnExit?: boolean;
};

type FoldStore = {
  folds: Fold[];
  loaded: boolean;
  load: () => void;
  addFold: (fold: NewFold) => Fold;
  removeFold: (id: string) => void;
  toggleFold: (id: string) => void;
  updateFold: (id: string, patch: Partial<Omit<Fold, 'id' | 'createdAt'>>) => void;
};

export const useFoldStore = create<FoldStore>((set, get) => ({
  folds: [],
  loaded: false,

  load: () => {
    const db = getDb();
    set({ folds: listFolds(db), loaded: true });
  },

  addFold: (fold) => {
    const db = getDb();
    const created = insertFold(db, {
      name: fold.name,
      geometry: fold.geometry,
      profileId: fold.profileId,
      iconType: fold.iconType ?? 'custom',
      edgeColor: fold.edgeColor ?? 'cyan',
      enabled: true,
      priority: fold.priority ?? 5,
      dwellEnterMs: fold.dwellEnterMs ?? 8000,
      dwellExitMs: fold.dwellExitMs ?? 8000,
      restoreOnExit: fold.restoreOnExit ?? true,
    });
    set((state) => ({ folds: [...state.folds, created] }));
    return created;
  },

  removeFold: (id) => {
    const db = getDb();
    deleteFold(db, id);
    set((state) => ({ folds: state.folds.filter((f) => f.id !== id) }));
  },

  toggleFold: (id) => {
    const db = getDb();
    const fold = get().folds.find((f) => f.id === id);
    if (!fold) return;
    updateFoldRow(db, id, { enabled: !fold.enabled });
    set((state) => ({
      folds: state.folds.map((f) => (f.id === id ? { ...f, enabled: !f.enabled, updatedAt: Date.now() } : f)),
    }));
  },

  updateFold: (id, patch) => {
    const db = getDb();
    updateFoldRow(db, id, patch);
    set((state) => ({
      folds: state.folds.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: Date.now() } : f)),
    }));
  },
}));
