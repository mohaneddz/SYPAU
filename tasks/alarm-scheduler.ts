import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Alarm } from '@/types/alarm';

const ALARM_CHANNEL_ID = 'sypau-alarms';

export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function cancelAlarmNotifications(alarmId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const mine = scheduled.filter((n) => n.content.data?.alarmId === alarmId);
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await cancelAlarmNotifications(alarm.id);
  if (!alarm.enabled) return;

  await ensureAlarmChannel();

  const content: Notifications.NotificationContentInput = {
    title: alarm.label || 'Alarm',
    body: 'Tap to open SYPAU',
    data: { alarmId: alarm.id },
    sound: 'default',
  };

  if (alarm.repeatDays.length === 0) {
    const next = nextOccurrence(alarm.hour, alarm.minute);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next, channelId: ALARM_CHANNEL_ID },
    });
    return;
  }

  await Promise.all(
    alarm.repeatDays.map((day) =>
      Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo-notifications: 1 = Sunday
          hour: alarm.hour,
          minute: alarm.minute,
          channelId: ALARM_CHANNEL_ID,
        },
      })
    )
  );
}

function nextOccurrence(hour: number, minute: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
