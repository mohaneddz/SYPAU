import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { CREATE_TABLES_SQL } from '@/db/schema';
import { seedDefaultProfiles } from '@/db/queries';

const DB_NAME = 'sypau.db';

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');
    db.execSync(CREATE_TABLES_SQL);
    seedDefaultProfiles(db);
  }
  return db;
}
