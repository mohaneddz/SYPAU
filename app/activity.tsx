import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { SypauConfirmDialog, SypauEmptyState } from '@/components/sypau/feedback';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { TornEdge } from '@/components/sypau/tornEdge';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useActivityStore } from '@/state/useActivityStore';
import { useZoneStore } from '@/state/useZoneStore';
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
  const [searchOpen, setSearchOpen] = useState(search.length > 0);
  const zones = useZoneStore((s) => s.zones);
  const zoneExists = (id: string) => zones.some((zone) => zone.id === id);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByDay(events), [events]);

  const openEvent = (event: ActivityEvent) => {
    // Zone events lead somewhere real; everything else explains itself.
    if (event.category === 'zone' && event.zoneId && zoneExists(event.zoneId)) {
      router.push({ pathname: '/zones/[id]', params: { id: event.zoneId } });
      return;
    }
    setSelected(event);
  };

  return (
    <SypauScaffold
      // Matches the tab. "Activity Log" doesn't fit beside the two header
      // actions, and Android dropped "Log" rather than shrinking it.
      title="Activity"
      handTitle
      headerRight={
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search events'}
            hitSlop={10}
            onPress={() => {
              if (searchOpen) setSearch('');
              setSearchOpen((open) => !open);
            }}>
            <SypauIcon name={searchOpen ? 'close' : 'search'} size={20} color={SypauColor.boneMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear history"
            hitSlop={10}
            onPress={() => setConfirmClear(true)}>
            <SypauIcon name="trash" size={20} color={SypauColor.boneMuted} />
          </Pressable>
        </View>
      }>
      {searchOpen ? (
        <View style={styles.searchRow}>
          <SypauIcon name="search" size={16} color={SypauColor.boneFaint} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search events"
            placeholderTextColor={SypauColor.boneFaint}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : null}

      <View style={styles.tabs} accessibilityRole="tablist">
        {FILTERS.map((entry, index) => (
          <TornTab
            key={entry.value}
            label={entry.label}
            selected={filter === entry.value}
            seed={index * 7 + 3}
            onPress={() => setFilter(entry.value)}
          />
        ))}
      </View>

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

            {group.events.map((event) => {
              const mark = trailingMark(event, zoneExists);
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}. ${event.description ?? ''} ${formatTime(event.timestamp)}`}
                  onPress={() => openEvent(event)}
                  style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}>
                  <View style={[styles.eventIcon, { borderColor: severityColor(event.severity) }]}>
                    {event.category === 'profile' && event.severity !== 'warning' ? (
                      <Image source={SypauAsset.emblem} style={styles.eventEmblem} contentFit="contain" />
                    ) : (
                      <SypauIcon
                        name={CATEGORY_ICONS[event.category]}
                        size={18}
                        color={severityColor(event.severity)}
                      />
                    )}
                  </View>

                  <View style={styles.eventText}>
                    <View style={styles.eventTitleRow}>
                      <SypauText variant="bodyMedium" style={styles.eventTitle} numberOfLines={2}>
                        {event.title}
                      </SypauText>
                      <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                        {formatTime(event.timestamp)}
                      </SypauText>
                    </View>
                    {event.description ? (
                      <SypauText variant="bodySm" color={SypauColor.boneMuted} numberOfLines={2}>
                        {event.description}
                      </SypauText>
                    ) : null}
                  </View>

                  <View style={styles.mark}>
                    {mark === 'chevron' ? (
                      <SypauIcon name="chevron" size={22} color={SypauColor.boneMuted} />
                    ) : mark === 'blocked' ? (
                      <SypauIcon name="lock" size={20} color={SypauColor.amber} />
                    ) : mark === 'error' ? (
                      <SypauIcon name="close" size={24} color={SypauColor.red} />
                    ) : (
                      <SypauIcon name="info" size={18} color={SypauColor.boneFaint} />
                    )}
                  </View>
                </Pressable>
              );
            })}
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

/** What the row's trailing mark says about the event, per the activity reference. */
function trailingMark(
  event: ActivityEvent,
  zoneExists: (id: string) => boolean
): 'chevron' | 'blocked' | 'error' | 'detail' {
  if (event.severity === 'error') return 'error';
  if (event.severity === 'warning') return 'blocked';
  if (event.category === 'zone' && event.zoneId && zoneExists(event.zoneId)) return 'chevron';
  return 'detail';
}

/**
 * A filter tab cut from card stock: ragged top and bottom, red when chosen,
 * as on the activity reference.
 */
function TornTab({
  label,
  selected,
  seed,
  onPress,
}: {
  label: string;
  selected: boolean;
  seed: number;
  onPress: () => void;
}) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.tab, selected && styles.tabSelected]}>
      <Grain opacity={selected ? 0.2 : 0.14} />
      <View style={styles.tabTearTop}>
        <TornEdge width={width} color={SypauColor.ink} facing="up" seed={seed} height={5} />
      </View>
      <SypauText
        variant="bodyMedium"
        numberOfLines={1}
        adjustsFontSizeToFit
        color={selected ? SypauColor.bone : SypauColor.boneMuted}>
        {label}
      </SypauText>
      <View style={styles.tabTearBottom}>
        <TornEdge width={width} color={SypauColor.ink} facing="down" seed={seed + 11} height={5} />
      </View>
    </Pressable>
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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.lg },

  tabs: { flexDirection: 'row', gap: SypauSpace.xs },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SypauSpace.md,
    paddingHorizontal: 2,
    backgroundColor: SypauColor.surfaceRaised,
    overflow: 'hidden',
  },
  tabSelected: { backgroundColor: SypauColor.red },
  tabTearTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  tabTearBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },

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
    backgroundColor: SypauColor.surface,
  },
  eventEmblem: { width: 30, height: 26 },
  eventText: { flex: 1, gap: 2 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: SypauSpace.sm },
  eventTitle: { flex: 1, color: SypauColor.bone },
  mark: { width: 26, alignItems: 'center' },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SypauSpace.xs,
  },

  pressed: { opacity: 0.7 },
});
