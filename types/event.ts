export type EventType =
  | 'ENTER'
  | 'EXIT'
  | 'RESOLVE_CHANGE'
  | 'HOLDING'
  | 'GPS_DRIFT'
  | 'PERMISSION'
  | 'ENGINE_RESTART'
  | 'ENGINE_ERROR';

export type FieldEvent = {
  id: string;
  ts: number;
  type: EventType;
  foldId: string | null;
  payload: Record<string, unknown>;
};
