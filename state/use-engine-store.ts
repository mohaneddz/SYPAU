import { create } from 'zustand';

import type { LatLng } from '@/engine/geo';

export type EngineStatus = 'armed' | 'idle' | 'holding';

type EngineStore = {
  currentLocation: LatLng | null;
  resolvedFoldId: string | null;
  activeProfileId: string | null;
  status: EngineStatus;
  setLocation: (location: LatLng | null) => void;
  setResolvedFoldId: (id: string | null) => void;
  setActiveProfileId: (id: string | null) => void;
  setStatus: (status: EngineStatus) => void;
};

export const useEngineStore = create<EngineStore>((set) => ({
  currentLocation: null,
  resolvedFoldId: null,
  activeProfileId: null,
  status: 'idle',
  setLocation: (location) => set({ currentLocation: location }),
  setResolvedFoldId: (id) => set({ resolvedFoldId: id }),
  setActiveProfileId: (id) => set({ activeProfileId: id }),
  setStatus: (status) => set({ status }),
}));
