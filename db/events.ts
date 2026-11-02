import { getDb } from '@/db/client';
import type { ActivityEvent, EventCategory, EventSeverity } from '@/types/event';
import { generateId } from '@/utils/uuid';

type EventRow = {
  id: string;
  timestamp: number;
  category: string;
  zoneId: string | null;
  profileId: string | null;
  title: string;
  description: string | null;
  severity: string;
  metadataJson: string;
};

function fromRow(row: EventRow): ActivityEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    category: row.category as EventCategory,
    zoneId: row.zoneId,
    profileId: row.profileId,
    title: row.title,
    description: row.description,
    severity: row.severity as EventSeverity,
    metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
  };
}

export type LogInput = {
  category: EventCategory;
  title: string;
  description?: string | null;
  severity?: EventSeverity;
  zoneId?: string | null;
  profileId?: string | null;
  metadata?: Record<string, unknown>;
};

export function logEvent(input: LogInput): ActivityEvent {
  const event: ActivityEvent = {
    id: generateId(),
    timestamp: Date.now(),
    category: input.category,
    zoneId: input.zoneId ?? null,
    profileId: input.profileId ?? null,
    title: input.title,
    description: input.description ?? null,
    severity: input.severity ?? 'info',
    metadata: input.metadata ?? {},
  };

  getDb().runSync(
    `INSERT INTO activityEvents (id, timestamp, category, zoneId, profileId, title,
                                 description, severity, metadataJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.timestamp,
    event.category,
    event.zoneId,
    event.profileId,
    event.title,
    event.description,
    event.severity,
    JSON.stringify(event.metadata)
  );

  return event;
}

/** Several events from one transition, written together to spare the disk. */
export function logEvents(inputs: LogInput[]): void {
  if (inputs.length === 0) return;
  getDb().withTransactionSync(() => {
    for (const input of inputs) logEvent(input);
  });
}

export function listEvents(options: { category?: EventCategory; limit?: number; search?: string } = {}): ActivityEvent[] {
  const { category, limit = 200, search } = options;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (search?.trim()) {
    where.push('(title LIKE ? OR description LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);

  return getDb()
    .getAllSync<EventRow>(
      `SELECT * FROM activityEvents ${clause} ORDER BY timestamp DESC LIMIT ?`,
      ...params
    )
    .map(fromRow);
}

export function listEventsForZone(zoneId: string, limit = 20): ActivityEvent[] {
  return getDb()
    .getAllSync<EventRow>(
      'SELECT * FROM activityEvents WHERE zoneId = ? ORDER BY timestamp DESC LIMIT ?',
      zoneId,
      limit
    )
    .map(fromRow);
}

/** The most recent of the given titles, for telling whether a failure was ever followed up. */
export function latestEventTitle(titles: string[]): string | null {
  if (titles.length === 0) return null;
  const row = getDb().getFirstSync<{ title: string }>(
    `SELECT title FROM activityEvents WHERE title IN (${titles.map(() => '?').join(', ')})
     ORDER BY timestamp DESC LIMIT 1`,
    ...titles
  );
  return row?.title ?? null;
}

export function countEventsSince(since: number): number {
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM activityEvents WHERE timestamp >= ?',
    since
  );
  return row?.n ?? 0;
}

export function clearEvents(): void {
  getDb().runSync('DELETE FROM activityEvents');
}

/** Retention trim, so a long-running install doesn't grow without bound. */
export function pruneEvents(retentionDays: number): number {
  if (retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const result = getDb().runSync('DELETE FROM activityEvents WHERE timestamp < ?', cutoff);
  return result.changes;
}
