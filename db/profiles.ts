import { getDb } from '@/db/client';
import {
  EMPTY_PROFILE_CONFIG,
  STARTER_PROFILES,
  type Profile,
  type ProfileConfig,
  type ProfileIcon,
} from '@/types/profile';
import { generateId } from '@/utils/uuid';

type ProfileRow = {
  id: string;
  name: string;
  icon: string;
  isDefault: number;
  configJson: string;
  createdAt: number;
  updatedAt: number;
};

function fromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as ProfileIcon,
    isDefault: row.isDefault === 1,
    // Merged over the empty config so a profile written by an older build
    // gains any newly added control as "unchanged" rather than undefined.
    config: { ...EMPTY_PROFILE_CONFIG, ...(JSON.parse(row.configJson) as ProfileConfig) },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listProfiles(): Profile[] {
  return getDb()
    .getAllSync<ProfileRow>('SELECT * FROM profiles ORDER BY isDefault DESC, name COLLATE NOCASE ASC')
    .map(fromRow);
}

export function getProfile(id: string): Profile | null {
  const row = getDb().getFirstSync<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export function getDefaultProfile(): Profile | null {
  const row = getDb().getFirstSync<ProfileRow>('SELECT * FROM profiles WHERE isDefault = 1 LIMIT 1');
  return row ? fromRow(row) : null;
}

export function createProfile(input: {
  name: string;
  icon: ProfileIcon;
  config: ProfileConfig;
  isDefault?: boolean;
}): Profile {
  const now = Date.now();
  const profile: Profile = {
    id: generateId(),
    name: input.name,
    icon: input.icon,
    isDefault: input.isDefault ?? false,
    config: input.config,
    createdAt: now,
    updatedAt: now,
  };

  const db = getDb();
  db.withTransactionSync(() => {
    if (profile.isDefault) db.runSync('UPDATE profiles SET isDefault = 0');
    db.runSync(
      `INSERT INTO profiles (id, name, icon, isDefault, configJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      profile.id,
      profile.name,
      profile.icon,
      profile.isDefault ? 1 : 0,
      JSON.stringify(profile.config),
      profile.createdAt,
      profile.updatedAt
    );
  });

  return profile;
}

export function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'name' | 'icon' | 'config' | 'isDefault'>>
): void {
  const existing = getProfile(id);
  if (!existing) return;

  const next: Profile = { ...existing, ...patch, updatedAt: Date.now() };
  const db = getDb();

  db.withTransactionSync(() => {
    if (next.isDefault) db.runSync('UPDATE profiles SET isDefault = 0');
    db.runSync(
      `UPDATE profiles SET name = ?, icon = ?, isDefault = ?, configJson = ?, updatedAt = ?
       WHERE id = ?`,
      next.name,
      next.icon,
      next.isDefault ? 1 : 0,
      JSON.stringify(next.config),
      next.updatedAt,
      id
    );
  });
}

export function duplicateProfile(id: string): Profile | null {
  const source = getProfile(id);
  if (!source) return null;

  return createProfile({
    name: nextCopyName(source.name),
    icon: source.icon,
    config: source.config,
    isDefault: false,
  });
}

function nextCopyName(name: string): string {
  const taken = new Set(listProfiles().map((p) => p.name.toLowerCase()));
  const base = `${name} Copy`;
  if (!taken.has(base.toLowerCase())) return base;

  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

export function countZonesUsingProfile(profileId: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM zones WHERE profileId = ?',
    profileId
  );
  return row?.n ?? 0;
}

export type ProfileDeleteRefusal = { ok: false; reason: 'inUse' | 'isDefault' | 'lastProfile'; zoneCount: number };

/**
 * Deleting a profile a zone points at would leave that zone unable to resolve,
 * so it's refused with a reason the UI can explain rather than cascaded.
 */
export function deleteProfile(id: string): { ok: true } | ProfileDeleteRefusal {
  const profile = getProfile(id);
  if (!profile) return { ok: true };

  const zoneCount = countZonesUsingProfile(id);
  if (zoneCount > 0) return { ok: false, reason: 'inUse', zoneCount };
  if (profile.isDefault) return { ok: false, reason: 'isDefault', zoneCount: 0 };
  if (listProfiles().length <= 1) return { ok: false, reason: 'lastProfile', zoneCount: 0 };

  getDb().runSync('DELETE FROM profiles WHERE id = ?', id);
  return { ok: true };
}

/** Real starter profiles, written once so a fresh install is usable. */
export function seedStarterProfiles(): void {
  const db = getDb();
  const row = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM profiles');
  if ((row?.n ?? 0) > 0) return;

  for (const starter of STARTER_PROFILES) {
    createProfile(starter);
  }
}
