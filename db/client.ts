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

  if (current < SCHEMA_VERSION) {
    database.execSync(DROP_LEGACY_SQL);
    database.execSync(CREATE_TABLES_SQL);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    return;
  }

  database.execSync(CREATE_TABLES_SQL);
}

/** Test seam: lets the suite point the data layer at an in-memory database. */
export function setDbForTesting(next: SQLiteDatabase | null): void {
  db = next;
}
