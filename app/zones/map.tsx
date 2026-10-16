import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SypauEmptyState } from '@/components/sypau/feedback';
import { SypauHeader } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { ZoneMap, type ZoneMapHandle } from '@/components/sypau/zoneMap';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { geometryArea } from '@/engine/geo';
import { useEngineStore } from '@/state/useEngineStore';
import { useZoneStore } from '@/state/useZoneStore';
import { formatArea, geometriesOverlap } from '@/utils/geometry';
import type { Zone } from '@/types/zone';

/**
 * Every zone on one map. The list screen shows zones one at a time; this is
 * where you see how they sit against each other — what's covered, what isn't,
 * and where two zones fight over the same ground.
 */
export default function ZoneCoverageRoute() {
  const insets = useSafeAreaInsets();
  const zones = useZoneStore((s) => s.zones);
  const fix = useEngineStore((s) => s.fix);
  const engine = useEngineStore((s) => s.engine);

  const mapControl = useRef<ZoneMapHandle | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const geometries = useMemo(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        geometry: zone.geometry,
        muted: !zone.enabled,
        label: zone.name,
      })),
    [zones]
  );

  const coverage = useMemo(() => summarise(zones), [zones]);

  const focus = (zone: Zone) => {
    // A second tap on the zone already framed opens it, so the strip doubles
    // as navigation without a separate button per card.
    if (focusedId === zone.id) {
      router.push({ pathname: '/zones/[id]', params: { id: zone.id } });
      return;
    }
    setFocusedId(zone.id);
    mapControl.current?.fitTo([zone.geometry]);
  };

  if (zones.length === 0) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <SypauHeader title="Coverage" showBack />
        <View style={styles.emptyWrap}>
          <SypauEmptyState
            art="map"
            title="Nothing mapped"
            description="Draw a zone and it shows up here, alongside every other one you add."
            actionLabel="Create a zone"
            onAction={() => router.replace('/zones/create')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ZoneMap
        geometries={geometries}
        userLocation={fix?.point ?? null}
        controlRef={mapControl}
        fitPadding={72}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <SypauHeader title="Coverage" showBack />
      </View>

      <View style={[styles.summary, { top: insets.top + 78 }]}>
        <Grain opacity={0.12} />
        <Stat label="Zones" value={String(zones.length)} />
        <View style={styles.summaryDivider} />
        <Stat label="Covered" value={formatArea(coverage.area)} />
        <View style={styles.summaryDivider} />
        <Stat
          label="Overlaps"
          value={String(coverage.overlaps)}
          tone={coverage.overlaps > 0 ? SypauColor.amber : SypauColor.bone}
        />
      </View>

      <View style={[styles.controls, { top: insets.top + 160 }]}>
        <MapButton
          icon="locate"
          label="Centre on me"
          disabled={!fix}
          onPress={() => fix && mapControl.current?.flyTo(fix.point, 15)}
        />
        <MapButton
          icon="layers"
          label="Show every zone"
          onPress={() => {
            setFocusedId(null);
            mapControl.current?.fitAll();
          }}
        />
        <MapButton icon="plus" label="Zoom in" onPress={() => mapControl.current?.zoomBy(1)} />
        <MapButton icon="minus" label="Zoom out" onPress={() => mapControl.current?.zoomBy(-1)} />
      </View>

      <View style={[styles.strip, { paddingBottom: insets.bottom + SypauSpace.lg }]}>
        {coverage.overlaps > 0 ? (
          <View style={styles.notice}>
            <SypauIcon name="alert" size={14} color={SypauColor.amber} />
            <SypauText variant="bodySm" color={SypauColor.boneMuted} style={styles.flex}>
              Where zones overlap, the higher priority wins and the other waits.
            </SypauText>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}>
          {zones.map((zone) => {
            const focused = focusedId === zone.id;
            const inside = engine.matchedZoneIds.includes(zone.id);
            return (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={zone.name}
                accessibilityHint={focused ? 'Opens the zone' : 'Frames the zone on the map'}
                onPress={() => focus(zone)}
                style={({ pressed }) => [
                  styles.zoneChip,
                  focused && styles.zoneChipFocused,
                  pressed && styles.pressed,
                ]}>
                <Grain opacity={0.12} />
                <View style={styles.zoneChipHeader}>
                  <SypauIcon
                    name={zone.icon}
                    size={16}
                    color={zone.enabled ? SypauColor.cyan : SypauColor.boneFaint}
                  />
                  <SypauText variant="label" caps numberOfLines={1} style={styles.flex}>
                    {zone.name}
                  </SypauText>
                  {focused ? <SypauIcon name="chevron" size={16} color={SypauColor.red} /> : null}
                </View>
                <SypauText variant="bodySm" color={SypauColor.boneMuted}>
                  {formatArea(geometryArea(zone.geometry))}
                </SypauText>
                <SypauText
                  variant="labelSm"
                  caps
                  color={!zone.enabled ? SypauColor.red : inside ? SypauColor.cyan : SypauColor.boneFaint}>
                  {!zone.enabled ? 'Paused' : inside ? 'You’re here' : `Priority ${zone.priority}`}
                </SypauText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * Total ground covered and how many pairs of zones overlap. The area is a sum,
 * so overlapping ground counts twice — the overlap count says when that's so.
 */
function summarise(zones: Zone[]): { area: number; overlaps: number } {
  const enabled = zones.filter((zone) => zone.enabled);
  let overlaps = 0;
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      if (geometriesOverlap(enabled[i].geometry, enabled[j].geometry)) overlaps++;
    }
  }
  return {
    area: enabled.reduce((sum, zone) => sum + geometryArea(zone.geometry), 0),
    overlaps,
  };
}

function Stat({ label, value, tone = SypauColor.bone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <SypauText variant="labelSm" caps color={SypauColor.boneFaint}>
        {label}
      </SypauText>
      <SypauText variant="label" color={tone}>
        {value}
      </SypauText>
    </View>
  );
}

function MapButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: SypauIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <SypauIcon name={icon} size={22} color={SypauColor.paperInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: SypauColor.ink },
  flex: { flex: 1 },
  emptyWrap: { flex: 1, paddingHorizontal: SypauSpace.gutter },
  headerWrap: { position: 'absolute', left: 0, right: 0, top: 0 },

  summary: {
    position: 'absolute',
    left: SypauSpace.gutter,
    right: SypauSpace.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.card,
    paddingVertical: SypauSpace.md,
    overflow: 'hidden',
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: SypauColor.hairline },

  controls: { position: 'absolute', right: SypauSpace.gutter, gap: SypauSpace.md },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: SypauSpace.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginHorizontal: SypauSpace.gutter,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
    borderRadius: SypauRadius.chip,
    backgroundColor: 'rgba(13,13,13,0.92)',
  },
  stripContent: { paddingHorizontal: SypauSpace.gutter, gap: SypauSpace.md },
  zoneChip: {
    width: 170,
    gap: 4,
    padding: SypauSpace.md,
    borderRadius: SypauRadius.card,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    overflow: 'hidden',
  },
  zoneChipFocused: { borderColor: SypauColor.cyan, borderWidth: 1 },
  zoneChipHeader: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },

  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
