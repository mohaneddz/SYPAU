import { getDb } from '@/db/client';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

const KEY = 'appSettings';

export function loadSettings(): AppSettings {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM appSettings WHERE key = ?', KEY);
  if (!row) return { ...DEFAULT_SETTINGS };

  try {
    // Merged over defaults so a setting added in a later build has a value
    // rather than arriving undefined on an existing install.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  getDb().runSync(
    'INSERT INTO appSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    KEY,
    JSON.stringify(settings)
  );
}

export function resetAllData(): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM activityEvents');
    db.runSync('DELETE FROM zones');
    db.runSync('DELETE FROM profiles');
    db.runSync('DELETE FROM appSettings');
  });
}
