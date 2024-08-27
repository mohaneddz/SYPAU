export type Alarm = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
  /** 0 (Sunday) - 6 (Saturday); empty means one-shot. */
  repeatDays: number[];
  soundKey: string;
  createdAt: number;
  updatedAt: number;
};
