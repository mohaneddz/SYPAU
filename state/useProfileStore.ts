import { create } from 'zustand';

import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  listProfiles,
  updateProfile,
  type ProfileDeleteRefusal,
} from '@/db/profiles';
import type { Profile, ProfileConfig, ProfileIcon } from '@/types/profile';

type ProfileStore = {
  profiles: Profile[];
  load: () => void;
  create: (input: { name: string; icon: ProfileIcon; config: ProfileConfig; isDefault?: boolean }) => Profile;
  update: (id: string, patch: Partial<Pick<Profile, 'name' | 'icon' | 'config' | 'isDefault'>>) => void;
  duplicate: (id: string) => Profile | null;
  remove: (id: string) => { ok: true } | ProfileDeleteRefusal;
  byId: (id: string | null | undefined) => Profile | null;
};

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],

  load: () => set({ profiles: listProfiles() }),

  create: (input) => {
    const profile = createProfile(input);
    get().load();
    return profile;
  },

  update: (id, patch) => {
    updateProfile(id, patch);
    get().load();
  },

  duplicate: (id) => {
    const copy = duplicateProfile(id);
    get().load();
    return copy;
  },

  remove: (id) => {
    const result = deleteProfile(id);
    if (result.ok) get().load();
    return result;
  },

  byId: (id) => (id ? (get().profiles.find((p) => p.id === id) ?? null) : null),
}));
