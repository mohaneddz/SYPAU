/**
 * Schema v2. The v1 tables (folds, alarms) belonged to the retired
 * "Silence Origami" concept and are dropped on migration — the concepts don't
 * map across, and shipping a half-translated fold would be worse than a clean
 * start on a pre-release app.
 */

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  isDefault   INTEGER NOT NULL DEFAULT 0,
  configJson  TEXT NOT NULL,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zones (
  id                      TEXT PRIMARY KEY NOT NULL,
  name                    TEXT NOT NULL,
  icon                    TEXT NOT NULL,
  enabled                 INTEGER NOT NULL DEFAULT 1,
  boundaryType            TEXT NOT NULL,
  geometryJson            TEXT NOT NULL,
  profileId               TEXT NOT NULL,
  exitBehavior            TEXT NOT NULL,
  exitProfileId           TEXT,
  priority                INTEGER NOT NULL DEFAULT 10,
  activationDelaySeconds  INTEGER NOT NULL DEFAULT 0,
  exitDelaySeconds        INTEGER NOT NULL DEFAULT 0,
  createdAt               INTEGER NOT NULL,
  updatedAt               INTEGER NOT NULL,
  lastEnteredAt           INTEGER,
  lastExitedAt            INTEGER,
  FOREIGN KEY (profileId)     REFERENCES profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (exitProfileId) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activityEvents (
  id           TEXT PRIMARY KEY NOT NULL,
  timestamp    INTEGER NOT NULL,
  category     TEXT NOT NULL,
  zoneId       TEXT,
  profileId    TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  severity     TEXT NOT NULL,
  metadataJson TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS appSettings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxEventsTimestamp ON activityEvents(timestamp DESC);
CREATE INDEX IF NOT EXISTS idxEventsCategory  ON activityEvents(category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idxZonesProfile    ON zones(profileId);
`;

/** Tables from the retired concept, removed when migrating a v1 database. */
export const DROP_LEGACY_SQL = `
DROP TABLE IF EXISTS folds;
DROP TABLE IF EXISTS alarms;
DROP TABLE IF EXISTS events;
`;
