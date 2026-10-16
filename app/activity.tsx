import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { SypauConfirmDialog, SypauEmptyState } from '@/components/sypau/feedback';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useActivityStore } from '@/state/useActivityStore';
import type { ActivityEvent, ActivityFilter } from '@/types/event';

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'zone', label: 'Zone' },
  { value: 'profile', label: 'Profile' },
  { value: 'system', label: 'System' },
  { value: 'error', label: 'Errors' },
];

const CATEGORY_ICONS: Record<ActivityEvent['category'], SypauIconName> = {
  zone: 'pin',
  profile: 'layers',
  system: 'settings',
  location: 'target',
  error: 'alert',
};

export default function ActivityRoute() {
  const events = useActivityStore((s) => s.events);
  const filter = useActivityStore((s) => s.filter);
  const search = useActivityStore((s) => s.search);
  const setFilter = useActivityStore((s) => s.setFilter);
  const setSearch = useActivityStore((s) => s.setSearch);
  const load = useActivityStore((s) => s.load);
  const clear = useActivityStore((s) => s.clear);

  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByDay(events), [events]);

  return (
    <SypauScaffold
      title="Activity Log"
      showBack
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear history"
          hitSlop={10}
          onPress={() => setConfirmClear(true)}>
          <SypauIcon name="trash" size={20} color={SypauColor.boneMuted} />
        </Pressable>
      }>
      <View style={styles.searchRow}>
        <SypauIcon name="search" size={16} color={SypauColor.boneFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search events"
          placeholderTextColor={SypauColor.boneFaint}
          style={styles.searchInput}
        />
        {search.length > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSearch('')}>
            <SypauIcon name="close" size={16} color={SypauColor.boneMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}>
        {FILTERS.map((entry) => (
          <Pressable
            key={entry.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === entry.value }}
            onPress={() => setFilter(entry.value)}
            style={[styles.filterChip, filter === entry.value && styles.filterChipSelected]}>
            <SypauText
              variant="label"
              color={filter === entry.value ? SypauColor.bone : SypauColor.boneMuted}>
              {entry.label}
            </SypauText>
          </Pressable>
        ))}
      </ScrollView>

      {events.length === 0 ? (
        <SypauEmptyState
          title="Nothing here"
          description={
            search || filter !== 'all'
              ? 'No events match what you’re looking for.'
              : 'SYPAU logs every zone crossing, profile change and refusal here.'
          }
        />
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <SectionTitle>{group.label}</SectionTitle>

            {group.events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                onPress={() => setSelected(event)}
                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}>
                <View style={[styles.eventIcon, { borderColor: severityColor(event.severity) }]}>
                  <SypauIcon
                    name={CATEGORY_ICONS[event.category]}
                    size={17}
                    color={severityColor(event.severity)}
                  />
                </View>

                <View style={styles.eventText}>
                  <SypauText variant="bodyMedium" style={styles.eventTitle}>
                    {event.title}
                  </SypauText>
                  {event.description ? (
                    <SypauText variant="bodySm" color={SypauColor.boneMuted}>
                      {event.description}
                    </SypauText>
                  ) : null}
                </View>

                <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                  {formatTime(event.timestamp)}
                </SypauText>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <SypauConfirmDialog
        visible={selected !== null}
        title={selected?.title ?? ''}
        message={selected?.description ?? 'No further detail was recorded.'}
        confirmLabel="Close"
        cancelLabel={null}
        onCancel={() => setSelected(null)}
        onConfirm={() => setSelected(null)}>
        {selected ? (
          <DarkCard>
            <DetailRow label="Category" value={titleCase(selected.category)} />
            <DetailRow label="Severity" value={titleCase(selected.severity)} />
            <DetailRow label="When" value={new Date(selected.timestamp).toLocaleString()} />
          </DarkCard>
        ) : null}
      </SypauConfirmDialog>

      <SypauConfirmDialog
        visible={confirmClear}
        destructive
        title="Clear history?"
        message="Every logged event goes. Your zones and profiles stay."
        confirmLabel="Clear log"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
      />
    </SypauScaffold>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
        {label}
      </SypauText>
      <SypauText variant="bodySm">{value}</SypauText>
    </View>
  );
}

/** Today / Yesterday / a date, matching the reference's day grouping. */
function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups = new Map<string, ActivityEvent[]>();

  for (const event of events) {
    const label = dayLabel(event.timestamp);
    const bucket = groups.get(label);
    if (bucket) bucket.push(event);
    else groups.set(label, [event]);
  }

  return [...groups.entries()].map(([label, grouped]) => ({ label, events: grouped }));
}

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function severityColor(severity: ActivityEvent['severity']): string {
  switch (severity) {
    case 'success':
      return SypauColor.cyan;
    case 'warning':
      return SypauColor.amber;
    case 'error':
      return SypauColor.red;
    default:
      return SypauColor.boneMuted;
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    backgroundColor: SypauColor.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.chip,
    paddingHorizontal: SypauSpace.md,
  },
  searchInput: { flex: 1, color: SypauColor.bone, paddingVertical: SypauSpace.md },

  // A horizontal ScrollView has no intrinsic height, so in a column parent it
  // stretches to fill and the chips become full-height bars.
  filterScroll: { flexGrow: 0 },
  filters: { gap: SypauSpace.sm, paddingRight: SypauSpace.gutter, alignItems: 'center' },
  filterChip: {
    borderRadius: SypauRadius.chip,
    paddingHorizontal: SypauSpace.lg,
    paddingVertical: SypauSpace.sm,
    backgroundColor: SypauColor.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
  },
  filterChipSelected: { backgroundColor: SypauColor.red, borderColor: SypauColor.red },

  group: { gap: SypauSpace.xs },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SypauColor.hairline,
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: SypauRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: { flex: 1, gap: 2 },
  eventTitle: { color: SypauColor.bone },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SypauSpace.xs,
  },

  pressed: { opacity: 0.7 },
});
