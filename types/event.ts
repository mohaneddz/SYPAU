export type EventCategory = 'zone' | 'profile' | 'system' | 'location' | 'error';

export type EventSeverity = 'info' | 'success' | 'warning' | 'error';

export type ActivityEvent = {
  id: string;
  timestamp: number;
  category: EventCategory;
  zoneId: string | null;
  profileId: string | null;
  title: string;
  description: string | null;
  severity: EventSeverity;
  /** Structured extras for the detail sheet. Never shown raw to the user. */
  metadata: Record<string, unknown>;
};

export type ActivityFilter = 'all' | EventCategory;
