import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Prism, PrismType } from '@/constants/prism';
import { getDb } from '@/db/client';
import { listRecentEvents } from '@/db/queries';
import { useFoldStore } from '@/state/use-fold-store';
import type { EventType, FieldEvent } from '@/types/event';

const EVENT_LABEL: Record<EventType, string> = {
  ENTER: 'Entered',
  EXIT: 'Exited',
  RESOLVE_CHANGE: 'Switched fold',
  HOLDING: 'GPS drift — holding',
  GPS_DRIFT: 'GPS drift',
  PERMISSION: 'Permission changed',
  ENGINE_RESTART: 'Engine restarted',
  ENGINE_ERROR: 'Engine error',
};

const FILTERS: ('All' | EventType)[] = ['All', 'ENTER', 'EXIT', 'HOLDING', 'GPS_DRIFT', 'PERMISSION'];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ActivityScreen() {
  const [events, setEvents] = useState<FieldEvent[]>([]);
  const [filter, setFilter] = useState<'All' | EventType>('All');
  const folds = useFoldStore((state) => state.folds);

  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      setEvents(listRecentEvents(db, 200));
    }, [])
  );

  const filtered = useMemo(
    () => (filter === 'All' ? events : events.filter((e) => e.type === filter)),
    [events, filter]
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f} style={[styles.filterPill, filter === f && styles.filterPillSelected]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextSelected]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No activity yet. Enter a Fold to see events here.</Text>}
        renderItem={({ item }) => {
          const fold = folds.find((f) => f.id === item.foldId);
          return (
            <View style={styles.row}>
              <Text style={styles.time}>{formatTime(item.ts)}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.label}>{EVENT_LABEL[item.type]}</Text>
                {fold && <Text style={styles.detail}>{fold.name}</Text>}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    paddingBottom: 4,
  },
  filterPill: {
    backgroundColor: Prism.paperShadow,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillSelected: {
    borderColor: Prism.cyan,
  },
  filterText: {
    color: '#9AA3B2',
    fontSize: 12,
  },
  filterTextSelected: {
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  emptyText: {
    color: '#8892A6',
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  time: {
    ...PrismType.caption,
    color: '#8892A6',
    width: 52,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  detail: {
    ...PrismType.caption,
    color: '#8892A6',
  },
});
