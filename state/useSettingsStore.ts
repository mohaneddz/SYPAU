import { create } from 'zustand';

import { loadSettings, saveSettings } from '@/db/settings';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

type SettingsStore = {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => void;
  update: (patch: Partial<AppSettings>) => void;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Defaults until hydrate() runs, so the first render has real values rather
  // than a flash of unstyled state while SQLite opens.
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,

  hydrate: () => {
    set({ settings: loadSettings(), hydrated: true });
  },

  update: (patch) => {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    set({ settings: next });
  },
}));
