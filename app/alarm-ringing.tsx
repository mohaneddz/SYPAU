import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { Prism, PrismType } from '@/constants/prism';
import { useAlarmStore } from '@/state/use-alarm-store';
import { useEngineStore } from '@/state/use-engine-store';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';
import { getNotifications } from '@/utils/notifications';

const VIBRATE_PATTERN = [0, 400, 300];
const GENTLE_VIBRATE_PATTERN = [0, 150, 600];

export default function AlarmRingingScreen() {
  const { alarmId } = useLocalSearchParams<{ alarmId: string }>();
  const alarm = useAlarmStore((state) => state.alarms.find((a) => a.id === alarmId));
  const resolvedFoldId = useEngineStore((state) => state.resolvedFoldId);
  const activeProfileId = useEngineStore((state) => state.activeProfileId);
  const fold = useFoldStore((state) => state.folds.find((f) => f.id === resolvedFoldId));
  const profile = useProfileStore((state) => (activeProfileId ? state.getProfile(activeProfileId) : undefined));
  const [holding, setHolding] = useState(false);

  const intensity = profile?.config.alarmIntensity ?? 'normal';
  const requiresConfirm = profile?.config.gentleConfirm ?? false;
  const vibrate = profile?.config.vibrate ?? true;

  useEffect(() => {
    if (!vibrate) return;
    const pattern = intensity === 'gentle' ? GENTLE_VIBRATE_PATTERN : VIBRATE_PATTERN;
    Vibration.vibrate(pattern, true);
    return () => Vibration.cancel();
  }, [vibrate, intensity]);

  const timeLabel = useMemo(() => {
    if (!alarm) return '';
    const period = alarm.hour >= 12 ? 'PM' : 'AM';
    const displayHour = alarm.hour % 12 === 0 ? 12 : alarm.hour % 12;
    return `${displayHour}:${alarm.minute.toString().padStart(2, '0')} ${period}`;
  }, [alarm]);

  const dismiss = () => {
    Vibration.cancel();
    router.back();
  };

  const snooze = async () => {
    Vibration.cancel();
    const Notifications = await getNotifications();
    if (Notifications) {
      await Notifications.scheduleNotificationAsync({
        content: { title: alarm?.label || 'Alarm', body: 'Snoozed', data: { alarmId: alarmId ?? '' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 * 60, repeats: false },
      });
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      {intensity !== 'normal' && (
        <View style={styles.gentleBadge}>
          <Text style={styles.gentleBadgeText}>
            {intensity === 'silent' ? 'Silent' : 'Gentle'} · {fold?.name ?? profile?.name}
          </Text>
        </View>
      )}

      <Text style={styles.time}>{timeLabel}</Text>
      {!!alarm?.label && <Text style={styles.label}>{alarm.label}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.snoozeButton} onPress={snooze}>
          <Text style={styles.snoozeText}>Snooze 5m</Text>
        </Pressable>

        {requiresConfirm ? (
          <Pressable
            style={[styles.dismissButton, holding && styles.dismissButtonHolding]}
            onPressIn={() => setHolding(true)}
            onPressOut={() => setHolding(false)}
            onLongPress={dismiss}
            delayLongPress={800}>
            <Text style={styles.dismissText}>{holding ? 'Keep holding…' : 'Hold to dismiss'}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.dismissButton} onPress={dismiss}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  gentleBadge: {
    position: 'absolute',
    top: 80,
    borderColor: Prism.amber,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  gentleBadgeText: {
    color: Prism.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  time: {
    fontSize: 56,
    fontWeight: '700',
    color: Prism.ashPaper,
  },
  label: {
    ...PrismType.body,
    color: '#B7BFCC',
  },
  actions: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    gap: 14,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: Prism.cyan,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
  },
  dismissButtonHolding: {
    backgroundColor: Prism.violet,
  },
  dismissText: {
    color: Prism.inkBlack,
    fontWeight: '700',
    fontSize: 16,
  },
  snoozeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  snoozeText: {
    color: '#8892A6',
    fontWeight: '600',
  },
});
