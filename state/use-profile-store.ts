import { create } from 'zustand';

import { getDb } from '@/db/client';
import { insertCustomProfile, listProfiles, updateProfile as updateProfileRow } from '@/db/queries';
import type { Profile, ProfileConfig } from '@/types/profile';

type ProfileStore = {
  profiles: Profile[];
  loaded: boolean;
  load: () => void;
  addCustomProfile: (name: string, config: ProfileConfig) => Profile;
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'config'>>) => void;
  getProfile: (id: string) => Profile | undefined;
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  loaded: false,

  load: () => {
    const db = getDb();
    set({ profiles: listProfiles(db), loaded: true });
  },

  addCustomProfile: (name, config) => {
    const db = getDb();
    const created = insertCustomProfile(db, { name, config });
    set((state) => ({ profiles: [...state.profiles, created] }));
    return created;
  },

  updateProfile: (id, patch) => {
    const db = getDb();
    updateProfileRow(db, id, patch);
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }));
  },

  getProfile: (id) => get().profiles.find((p) => p.id === id),
}));
