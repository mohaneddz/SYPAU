import type { SQLiteDatabase } from 'expo-sqlite';

import type { Geometry } from '@/engine/geo';
import type { Alarm } from '@/types/alarm';
import type { FieldEvent, EventType } from '@/types/event';
import type { EdgeColor, Fold, IconType } from '@/types/fold';
import { PRESET_PROFILES, type Profile } from '@/types/profile';
import { generateId } from '@/utils/uuid';

type FoldRow = {
  id: string;
  name: string;
  iconType: string;
  edgeColor: string;
  enabled: number;
  priority: number;
  geometryType: string;
  geometryJson: string;
  profileId: string;
  dwellEnterMs: number;
  dwellExitMs: number;
  restoreOnExit: number;
  createdAt: number;
  updatedAt: number;
};

type ProfileRow = {
  id: string;
  name: string;
  presetKey: string | null;
  configJson: string;
  createdAt: number;
  updatedAt: number;
};

type EventRow = {
  id: string;
  ts: number;
  type: string;
  foldId: string | null;
  payloadJson: string;
};

type AlarmRow = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: number;
  repeatDaysJson: string;
  soundKey: string;
  createdAt: number;
  updatedAt: number;
};

function foldFromRow(row: FoldRow): Fold {
  return {
    id: row.id,
    name: row.name,
    iconType: row.iconType as IconType,
    edgeColor: row.edgeColor as EdgeColor,
    enabled: row.enabled === 1,
    priority: row.priority,
    geometry: JSON.parse(row.geometryJson) as Geometry,
    profileId: row.profileId,
    dwellEnterMs: row.dwellEnterMs,
    dwellExitMs: row.dwellExitMs,
    restoreOnExit: row.restoreOnExit === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    presetKey: (row.presetKey as Profile['presetKey']) ?? null,
    config: JSON.parse(row.configJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function eventFromRow(row: EventRow): FieldEvent {
  return {
    id: row.id,
    ts: row.ts,
    type: row.type as EventType,
    foldId: row.foldId,
    payload: JSON.parse(row.payloadJson),
  };
}

function alarmFromRow(row: AlarmRow): Alarm {
  return {
    id: row.id,
    label: row.label,
    hour: row.hour,
    minute: row.minute,
    enabled: row.enabled === 1,
    repeatDays: JSON.parse(row.repeatDaysJson),
    soundKey: row.soundKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// --- profiles ---

export function seedDefaultProfiles(db: SQLiteDatabase): void {
  const { count } = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM profiles') ?? {
    count: 0,
  };
  if (count > 0) return;

  const now = Date.now();
  db.withTransactionSync(() => {
    for (const [presetKey, preset] of Object.entries(PRESET_PROFILES)) {
      db.runSync(
        'INSERT INTO profiles (id, name, presetKey, configJson, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        generateId('profile'),
        preset.name,
        presetKey,
        JSON.stringify(preset.config),
        now,
        now
      );
    }
  });
}

export function listProfiles(db: SQLiteDatabase): Profile[] {
  return db.getAllSync<ProfileRow>('SELECT * FROM profiles ORDER BY createdAt ASC').map(profileFromRow);
}

export function getProfile(db: SQLiteDatabase, id: string): Profile | null {
  const row = db.getFirstSync<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id);
  return row ? profileFromRow(row) : null;
}

export function insertCustomProfile(
  db: SQLiteDatabase,
  profile: Pick<Profile, 'name' | 'config'>
): Profile {
  const now = Date.now();
  const id = generateId('profile');
  db.runSync(
    'INSERT INTO profiles (id, name, presetKey, configJson, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?, ?)',
    id,
    profile.name,
    JSON.stringify(profile.config),
    now,
    now
  );
  return { id, name: profile.name, presetKey: null, config: profile.config, createdAt: now, updatedAt: now };
}

// --- folds ---

export function updateProfile(db: SQLiteDatabase, id: string, patch: Partial<Pick<Profile, 'name' | 'config'>>): void {
  const current = db.getFirstSync<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id);
  if (!current) return;
  const merged = { ...profileFromRow(current), ...patch, updatedAt: Date.now() };
  db.runSync(
    'UPDATE profiles SET name = ?, configJson = ?, updatedAt = ? WHERE id = ?',
    merged.name,
    JSON.stringify(merged.config),
    merged.updatedAt,
    id
  );
}

export function listFolds(db: SQLiteDatabase): Fold[] {
  return db.getAllSync<FoldRow>('SELECT * FROM folds ORDER BY createdAt ASC').map(foldFromRow);
}

export function insertFold(
  db: SQLiteDatabase,
  fold: Omit<Fold, 'id' | 'createdAt' | 'updatedAt'>
): Fold {
  const now = Date.now();
  const id = generateId('fold');
  db.runSync(
    `INSERT INTO folds
      (id, name, iconType, edgeColor, enabled, priority, geometryType, geometryJson, profileId, dwellEnterMs, dwellExitMs, restoreOnExit, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    fold.name,
    fold.iconType,
    fold.edgeColor,
    fold.enabled ? 1 : 0,
    fold.priority,
    fold.geometry.type,
    JSON.stringify(fold.geometry),
    fold.profileId,
    fold.dwellEnterMs,
    fold.dwellExitMs,
    fold.restoreOnExit ? 1 : 0,
    now,
    now
  );
  return { ...fold, id, createdAt: now, updatedAt: now };
}

export function updateFold(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Fold, 'id' | 'createdAt'>>
): void {
  const current = db.getFirstSync<FoldRow>('SELECT * FROM folds WHERE id = ?', id);
  if (!current) return;
  const merged = { ...foldFromRow(current), ...patch, updatedAt: Date.now() };

  db.runSync(
    `UPDATE folds SET name = ?, iconType = ?, edgeColor = ?, enabled = ?, priority = ?, geometryType = ?, geometryJson = ?, profileId = ?, dwellEnterMs = ?, dwellExitMs = ?, restoreOnExit = ?, updatedAt = ?
     WHERE id = ?`,
    merged.name,
    merged.iconType,
    merged.edgeColor,
    merged.enabled ? 1 : 0,
    merged.priority,
    merged.geometry.type,
    JSON.stringify(merged.geometry),
    merged.profileId,
    merged.dwellEnterMs,
    merged.dwellExitMs,
    merged.restoreOnExit ? 1 : 0,
    merged.updatedAt,
    id
  );
}

export function deleteFold(db: SQLiteDatabase, id: string): void {
  db.runSync('DELETE FROM folds WHERE id = ?', id);
}

// --- events ---

export function insertEvent(
  db: SQLiteDatabase,
  event: Omit<FieldEvent, 'id'>
): FieldEvent {
  const id = generateId('event');
  db.runSync(
    'INSERT INTO events (id, ts, type, foldId, payloadJson) VALUES (?, ?, ?, ?, ?)',
    id,
    event.ts,
    event.type,
    event.foldId,
    JSON.stringify(event.payload)
  );
  return { ...event, id };
}

export function listRecentEvents(db: SQLiteDatabase, limit = 100): FieldEvent[] {
  return db
    .getAllSync<EventRow>('SELECT * FROM events ORDER BY ts DESC LIMIT ?', limit)
    .map(eventFromRow);
}

// --- settings ---

export function getSetting<T>(db: SQLiteDatabase, key: string, fallback: T): T {
  const row = db.getFirstSync<{ valueJson: string }>('SELECT valueJson FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return fallback;
  }
}

export function setSetting<T>(db: SQLiteDatabase, key: string, value: T): void {
  db.runSync(
    'INSERT INTO settings (key, valueJson) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson',
    key,
    JSON.stringify(value)
  );
}

// --- alarms ---

export function listAlarms(db: SQLiteDatabase): Alarm[] {
  return db.getAllSync<AlarmRow>('SELECT * FROM alarms ORDER BY hour ASC, minute ASC').map(alarmFromRow);
}

export function insertAlarm(db: SQLiteDatabase, alarm: Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>): Alarm {
  const now = Date.now();
  const id = generateId('alarm');
  db.runSync(
    'INSERT INTO alarms (id, label, hour, minute, enabled, repeatDaysJson, soundKey, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    alarm.label,
    alarm.hour,
    alarm.minute,
    alarm.enabled ? 1 : 0,
    JSON.stringify(alarm.repeatDays),
    alarm.soundKey,
    now,
    now
  );
  return { ...alarm, id, createdAt: now, updatedAt: now };
}

export function updateAlarm(db: SQLiteDatabase, id: string, patch: Partial<Omit<Alarm, 'id' | 'createdAt'>>): void {
  const current = db.getFirstSync<AlarmRow>('SELECT * FROM alarms WHERE id = ?', id);
  if (!current) return;
  const merged = { ...alarmFromRow(current), ...patch, updatedAt: Date.now() };

  db.runSync(
    'UPDATE alarms SET label = ?, hour = ?, minute = ?, enabled = ?, repeatDaysJson = ?, soundKey = ?, updatedAt = ? WHERE id = ?',
    merged.label,
    merged.hour,
    merged.minute,
    merged.enabled ? 1 : 0,
    JSON.stringify(merged.repeatDays),
    merged.soundKey,
    merged.updatedAt,
    id
  );
}

export function deleteAlarm(db: SQLiteDatabase, id: string): void {
  db.runSync('DELETE FROM alarms WHERE id = ?', id);
}
