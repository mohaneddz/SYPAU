import { create } from 'zustand';

import {
  createZone,
  deleteZone,
  duplicateZone,
  listZones,
  setZoneEnabled,
  updateZone,
  type ZoneInput,
} from '@/db/zones';
import type { Zone } from '@/types/zone';

type ZoneStore = {
  zones: Zone[];
  load: () => void;
  create: (input: ZoneInput) => Zone;
  update: (id: string, patch: Partial<ZoneInput>) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  duplicate: (id: string) => Zone | null;
  remove: (id: string) => void;
  byId: (id: string | null | undefined) => Zone | null;
};

export const useZoneStore = create<ZoneStore>((set, get) => ({
  zones: [],

  load: () => set({ zones: listZones() }),

  create: (input) => {
    const zone = createZone(input);
    get().load();
    return zone;
  },

  update: (id, patch) => {
    updateZone(id, patch);
    get().load();
  },

  setEnabled: (id, enabled) => {
    setZoneEnabled(id, enabled);
    get().load();
  },

  duplicate: (id) => {
    const copy = duplicateZone(id);
    get().load();
    return copy;
  },

  remove: (id) => {
    deleteZone(id);
    get().load();
  },

  byId: (id) => (id ? (get().zones.find((z) => z.id === id) ?? null) : null),
}));
