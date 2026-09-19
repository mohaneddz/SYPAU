import { getDb } from '@/db/client';
import type { Geometry } from '@/engine/geo';
import type { BoundaryType, ExitBehavior, Zone, ZoneIcon } from '@/types/zone';
import { generateId } from '@/utils/uuid';

type ZoneRow = {
  id: string;
  name: string;
  icon: string;
  enabled: number;
  boundaryType: string;
  geometryJson: string;
  profileId: string;
  exitBehavior: string;
  exitProfileId: string | null;
  priority: number;
  activationDelaySeconds: number;
  exitDelaySeconds: number;
  createdAt: number;
  updatedAt: number;
  lastEnteredAt: number | null;
  lastExitedAt: number | null;
};

function fromRow(row: ZoneRow): Zone {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as ZoneIcon,
    enabled: row.enabled === 1,
    boundaryType: row.boundaryType as BoundaryType,
    geometry: JSON.parse(row.geometryJson) as Geometry,
    profileId: row.profileId,
    exitBehavior: row.exitBehavior as ExitBehavior,
    exitProfileId: row.exitProfileId,
    priority: row.priority,
    activationDelaySeconds: row.activationDelaySeconds,
    exitDelaySeconds: row.exitDelaySeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEnteredAt: row.lastEnteredAt,
    lastExitedAt: row.lastExitedAt,
  };
}

export function listZones(): Zone[] {
  return getDb()
    .getAllSync<ZoneRow>('SELECT * FROM zones ORDER BY priority DESC, name COLLATE NOCASE ASC')
    .map(fromRow);
}

export function listEnabledZones(): Zone[] {
  return listZones().filter((zone) => zone.enabled);
}

export function getZone(id: string): Zone | null {
  const row = getDb().getFirstSync<ZoneRow>('SELECT * FROM zones WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export type ZoneInput = {
  name: string;
  icon: ZoneIcon;
  boundaryType: BoundaryType;
  geometry: Geometry;
  profileId: string;
  exitBehavior: ExitBehavior;
  exitProfileId: string | null;
  priority: number;
  activationDelaySeconds: number;
  exitDelaySeconds: number;
  enabled: boolean;
};

export function createZone(input: ZoneInput): Zone {
  const now = Date.now();
  const zone: Zone = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    lastEnteredAt: null,
    lastExitedAt: null,
  };

  getDb().runSync(
    `INSERT INTO zones (id, name, icon, enabled, boundaryType, geometryJson, profileId,
                        exitBehavior, exitProfileId, priority, activationDelaySeconds,
                        exitDelaySeconds, createdAt, updatedAt, lastEnteredAt, lastExitedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    zone.id,
    zone.name,
    zone.icon,
    zone.enabled ? 1 : 0,
    zone.boundaryType,
    JSON.stringify(zone.geometry),
    zone.profileId,
    zone.exitBehavior,
    zone.exitProfileId,
    zone.priority,
    zone.activationDelaySeconds,
    zone.exitDelaySeconds,
    zone.createdAt,
    zone.updatedAt
  );

  return zone;
}

export function updateZone(id: string, patch: Partial<ZoneInput>): void {
  const existing = getZone(id);
  if (!existing) return;

  const next = { ...existing, ...patch, updatedAt: Date.now() };

  getDb().runSync(
    `UPDATE zones SET name = ?, icon = ?, enabled = ?, boundaryType = ?, geometryJson = ?,
                      profileId = ?, exitBehavior = ?, exitProfileId = ?, priority = ?,
                      activationDelaySeconds = ?, exitDelaySeconds = ?, updatedAt = ?
     WHERE id = ?`,
    next.name,
    next.icon,
    next.enabled ? 1 : 0,
    next.boundaryType,
    JSON.stringify(next.geometry),
    next.profileId,
    next.exitBehavior,
    next.exitProfileId,
    next.priority,
    next.activationDelaySeconds,
    next.exitDelaySeconds,
    next.updatedAt,
    id
  );
}

export function setZoneEnabled(id: string, enabled: boolean): void {
  getDb().runSync('UPDATE zones SET enabled = ?, updatedAt = ? WHERE id = ?', enabled ? 1 : 0, Date.now(), id);
}

export function markZoneEntered(id: string, at: number): void {
  getDb().runSync('UPDATE zones SET lastEnteredAt = ? WHERE id = ?', at, id);
}

export function markZoneExited(id: string, at: number): void {
  getDb().runSync('UPDATE zones SET lastExitedAt = ? WHERE id = ?', at, id);
}

export function duplicateZone(id: string): Zone | null {
  const source = getZone(id);
  if (!source) return null;

  return createZone({
    name: `${source.name} Copy`,
    icon: source.icon,
    boundaryType: source.boundaryType,
    geometry: source.geometry,
    profileId: source.profileId,
    exitBehavior: source.exitBehavior,
    exitProfileId: source.exitProfileId,
    priority: source.priority,
    activationDelaySeconds: source.activationDelaySeconds,
    exitDelaySeconds: source.exitDelaySeconds,
    enabled: source.enabled,
  });
}

export function deleteZone(id: string): void {
  getDb().runSync('DELETE FROM zones WHERE id = ?', id);
}
