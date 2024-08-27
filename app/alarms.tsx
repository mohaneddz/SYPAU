import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/prism/button';
import { Card } from '@/components/prism/card';
import { Prism, PrismType } from '@/constants/prism';
import { useAlarmStore } from '@/state/use-alarm-store';
import type { Alarm } from '@/types/alarm';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export default function AlarmsScreen() {
  const alarms = useAlarmStore((state) => state.alarms);
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  const updateAlarm = useAlarmStore((state) => state.updateAlarm);
  const removeAlarm = useAlarmStore((state) => state.removeAlarm);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No alarms yet. Add one below.</Text>}
        renderItem={({ item }) => (
          <AlarmRow alarm={item} onUpdate={updateAlarm} onDelete={() => removeAlarm(item.id)} />
        )}
        ListFooterComponent={
          creating ? (
            <NewAlarmForm
              onCancel={() => setCreating(false)}
              onCreate={(input) => {
                addAlarm(input);
                setCreating(false);
              }}
            />
          ) : null
        }
      />

      {!creating && (
        <Pressable style={styles.fab} onPress={() => setCreating(true)}>
          <MaterialIcons name="add" size={26} color={Prism.inkBlack} />
        </Pressable>
      )}
    </View>
  );
}

function AlarmRow({
  alarm,
  onUpdate,
  onDelete,
}: {
  alarm: Alarm;
  onUpdate: (id: string, patch: Partial<Alarm>) => void;
  onDelete: () => void;
}) {
  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.time}>{formatTime(alarm.hour, alarm.minute)}</Text>
        <Switch value={alarm.enabled} onValueChange={(v) => onUpdate(alarm.id, { enabled: v })} trackColor={{ true: Prism.cyan }} />
      </View>
      {!!alarm.label && <Text style={styles.label}>{alarm.label}</Text>}
      <View style={styles.dayRow}>
        {DAY_LABELS.map((label, day) => (
          <View key={day} style={[styles.dayPill, alarm.repeatDays.includes(day) && styles.dayPillActive]}>
            <Text style={[styles.dayPillText, alarm.repeatDays.includes(day) && styles.dayPillTextActive]}>{label}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onDelete} style={styles.deleteLink}>
        <Text style={styles.deleteLinkText}>Delete</Text>
      </Pressable>
    </Card>
  );
}

function NewAlarmForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (alarm: Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel] = useState('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);

  const toggleDay = (day: number) => {
    setRepeatDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()));
  };

  return (
    <Card style={styles.row}>
      <View style={styles.timeStepperRow}>
        <TimeStepper value={hour} max={23} onChange={setHour} />
        <Text style={styles.timeColon}>:</Text>
        <TimeStepper value={minute} max={59} onChange={setMinute} pad />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Label (optional)"
        placeholderTextColor="#6B7280"
        value={label}
        onChangeText={setLabel}
      />

      <View style={styles.dayRow}>
        {DAY_LABELS.map((dayLabel, day) => (
          <Pressable
            key={day}
            style={[styles.dayPill, repeatDays.includes(day) && styles.dayPillActive]}
            onPress={() => toggleDay(day)}>
            <Text style={[styles.dayPillText, repeatDays.includes(day) && styles.dayPillTextActive]}>{dayLabel}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formActions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Button
          onPress={() => onCreate({ hour, minute, label, enabled: true, repeatDays, soundKey: 'default' })}
          style={{ flex: 1 }}>
          Save Alarm
        </Button>
      </View>
    </Card>
  );
}

function TimeStepper({ value, max, onChange, pad }: { value: number; max: number; onChange: (v: number) => void; pad?: boolean }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepperButton} onPress={() => onChange((value - 1 + max + 1) % (max + 1))}>
        <MaterialIcons name="remove" size={18} color={Prism.ashPaper} />
      </Pressable>
      <Text style={styles.stepperValue}>{pad ? value.toString().padStart(2, '0') : value}</Text>
      <Pressable style={styles.stepperButton} onPress={() => onChange((value + 1) % (max + 1))}>
        <MaterialIcons name="add" size={18} color={Prism.ashPaper} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  emptyText: {
    color: '#8892A6',
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    marginBottom: 12,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    ...PrismType.h2,
    color: Prism.ashPaper,
  },
  label: {
    ...PrismType.body,
    color: '#B7BFCC',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Prism.deepCharcoal,
  },
  dayPillActive: {
    backgroundColor: Prism.cyan,
  },
  dayPillText: {
    fontSize: 12,
    color: '#8892A6',
    fontWeight: '700',
  },
  dayPillTextActive: {
    color: Prism.inkBlack,
  },
  deleteLink: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deleteLinkText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
  },
  timeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeColon: {
    ...PrismType.h1,
    color: Prism.ashPaper,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...PrismType.h2,
    color: Prism.ashPaper,
    minWidth: 34,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Prism.deepCharcoal,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Prism.ashPaper,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  cancelButtonText: {
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Prism.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Prism.cyan,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
