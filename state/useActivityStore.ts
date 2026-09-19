import { create } from 'zustand';

import { clearEvents, listEvents, logEvent, type LogInput } from '@/db/events';
import type { ActivityEvent, ActivityFilter } from '@/types/event';

type ActivityStore = {
  events: ActivityEvent[];
  filter: ActivityFilter;
  search: string;
  load: () => void;
  setFilter: (filter: ActivityFilter) => void;
  setSearch: (search: string) => void;
  log: (input: LogInput) => void;
  clear: () => void;
};

export const useActivityStore = create<ActivityStore>((set, get) => ({
  events: [],
  filter: 'all',
  search: '',

  load: () => {
    const { filter, search } = get();
    set({ events: listEvents({ category: filter === 'all' ? undefined : filter, search }) });
  },

  setFilter: (filter) => {
    set({ filter });
    get().load();
  },

  setSearch: (search) => {
    set({ search });
    get().load();
  },

  log: (input) => {
    logEvent(input);
    get().load();
  },

  clear: () => {
    clearEvents();
    set({ events: [] });
  },
}));
