import { create } from 'zustand';

import { getDb } from '@/db/client';
import { deleteAlarm, insertAlarm, listAlarms, updateAlarm as updateAlarmRow } from '@/db/queries';
import { cancelAlarmNotifications, scheduleAlarm } from '@/tasks/alarm-scheduler';
import type { Alarm } from '@/types/alarm';

type AlarmStore = {
  alarms: Alarm[];
  loaded: boolean;
  load: () => void;
  addAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>) => Alarm;
  updateAlarm: (id: string, patch: Partial<Omit<Alarm, 'id' | 'createdAt'>>) => void;
  removeAlarm: (id: string) => void;
};

export const useAlarmStore = create<AlarmStore>((set, get) => ({
  alarms: [],
  loaded: false,

  load: () => {
    const db = getDb();
    set({ alarms: listAlarms(db), loaded: true });
  },

  addAlarm: (alarm) => {
    const db = getDb();
    const created = insertAlarm(db, alarm);
    set((state) => ({ alarms: [...state.alarms, created] }));
    scheduleAlarm(created);
    return created;
  },

  updateAlarm: (id, patch) => {
    const db = getDb();
    updateAlarmRow(db, id, patch);
    const updated = get().alarms.find((a) => a.id === id);
    if (!updated) return;
    const merged = { ...updated, ...patch, updatedAt: Date.now() };
    set((state) => ({ alarms: state.alarms.map((a) => (a.id === id ? merged : a)) }));
    scheduleAlarm(merged);
  },

  removeAlarm: (id) => {
    const db = getDb();
    deleteAlarm(db, id);
    set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) }));
    cancelAlarmNotifications(id);
  },
}));
