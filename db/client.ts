import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { CREATE_TABLES_SQL, DROP_LEGACY_SQL, SCHEMA_VERSION } from '@/db/schema';

const DB_NAME = 'sypau.db';

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (db) return db;

  db = openDatabaseSync(DB_NAME);
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  migrate(db);
  return db;
}

function migrate(database: SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;

  if (current < 2) {
    database.execSync(DROP_LEGACY_SQL);
    database.execSync(CREATE_TABLES_SQL);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    return;
  }

  database.execSync(CREATE_TABLES_SQL);

  if (current < 3) {
    // Early v2 builds created profiles without isDefault but still stamped the
    // file as v2, so every profile query failed and the app couldn't start.
    // Added in place rather than rebuilt, so their zones and profiles survive.
    addColumnIfMissing(database, 'profiles', 'isDefault', 'INTEGER NOT NULL DEFAULT 0');
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}

function addColumnIfMissing(
  database: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): void {
  const columns = database.getAllSync<{ name: string }>(`PRAGMA table_info(${table});`);
  if (columns.some((entry) => entry.name === column)) return;
  database.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

/** Test seam: lets the suite point the data layer at an in-memory database. */
export function setDbForTesting(next: SQLiteDatabase | null): void {
  db = next;
}
