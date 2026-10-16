import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { SypauSwitch } from '@/components/sypau/controls';
import { SypauConfirmDialog, SypauEmptyState } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SypauText } from '@/components/sypau/text';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { distanceToGeometry } from '@/engine/geo';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import { boundingCircle, formatDistance } from '@/utils/geometry';
import type { Zone } from '@/types/zone';

export default function ZonesRoute() {
  const zones = useZoneStore((s) => s.zones);
  const setEnabled = useZoneStore((s) => s.setEnabled);
  const duplicate = useZoneStore((s) => s.duplicate);
  const remove = useZoneStore((s) => s.remove);
  const profileById = useProfileStore((s) => s.byId);

  const engine = useEngineStore((s) => s.engine);
  const fix = useEngineStore((s) => s.fix);

  const [menuZone, setMenuZone] = useState<Zone | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);

  if (zones.length === 0) {
    return (
      <SypauScaffold title="My Zones" showBack>
        <SypauEmptyState
          art="map"
          title="No zones yet"
          description="A zone is a shape on a map with a profile attached. Draw one and SYPAU takes it from there."
          actionLabel="Create your first zone"
          onAction={() => router.push('/zones/create')}
        />
      </SypauScaffold>
    );
  }

  return (
    <SypauScaffold
      wordmark
      showBack
      headerRight={<CoverageButton onPress={() => router.push('/zones/map')} />}>
      <View style={styles.heading}>
        <Image source={SypauAsset.foldedMap} style={styles.headingArt} contentFit="contain" />
        <Display>My Zones</Display>
        <HandUnderline width={190} />
        <SypauText variant="hand" caps color={SypauColor.bone} style={styles.headingHand}>
          Your spaces. Your rules.
        </SypauText>
        <SypauText variant="body" color={SypauColor.boneMuted} style={styles.headingBody}>
          Create and manage the zones where your silence stays yours.
        </SypauText>
      </View>

      {zones.map((zone) => {
        const profile = profileById(zone.profileId);
        const isInside = engine.matchedZoneIds.includes(zone.id);
        const isActive = engine.activeZoneId === zone.id;
        const distance = fix ? distanceToGeometry(fix.point, zone.geometry) : null;
        const open = () => router.push({ pathname: '/zones/[id]', params: { id: zone.id } });

        const status = !zone.enabled
          ? { label: 'Paused', color: SypauColor.red }
          : isActive
            ? { label: 'Active', color: SypauColor.cyan }
            : isInside
              ? { label: 'Inside', color: SypauColor.cyan }
              : { label: 'Watching', color: SypauColor.boneMuted };

        return (
          <DarkCard key={zone.id} highlighted={isActive}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${zone.name}, ${status.label}`}
              accessibilityHint="Opens the zone. Long press for more options."
              onPress={open}
              onLongPress={() => setMenuZone(zone)}
              style={styles.cardRow}>
              <View style={styles.thumbnailWrap}>
                <ZoneMap
                  geometries={[{ id: zone.id, geometry: zone.geometry, muted: !zone.enabled }]}
                  interactive={false}
                  fitPadding={14}
                  style={styles.thumbnail}
                />
                <View style={styles.iconBadge}>
                  <SypauIcon name={zone.icon} size={15} color={SypauColor.paperInk} />
                </View>
              </View>

              <View style={styles.cardInfo}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.cardTitleText}>
                    <SypauText variant="cardTitle" caps numberOfLines={1}>
                      {zone.name}
                    </SypauText>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                      <SypauText variant="bodySm" color={status.color}>
                        {status.label}
                      </SypauText>
                    </View>
                  </View>

                  <SypauSwitch
                    value={zone.enabled}
                    onValueChange={(next) => setEnabled(zone.id, next)}
                    accessibilityLabel={`${zone.name} enabled`}
                  />
                </View>

                <View style={styles.metaRow}>
                  <SypauIcon name="locate" size={14} color={SypauColor.boneMuted} />
                  <SypauText variant="bodySm" color={SypauColor.boneMuted} style={styles.flex}>
                    Radius
                  </SypauText>
                  <SypauText variant="bodySm" color={SypauColor.bone}>
                    {formatDistance(effectiveRadius(zone))}
                  </SypauText>
                  <SypauIcon name="chevron" size={18} color={SypauColor.red} />
                </View>

                <View style={styles.metaRow}>
                  <SypauIcon name="layers" size={14} color={SypauColor.boneMuted} />
                  <View style={styles.flex}>
                    <SypauText variant="bodySm" color={SypauColor.boneMuted}>
                      {profile?.name ?? 'Profile missing'}
                    </SypauText>
                    <SypauText variant="bodySm" color={SypauColor.boneFaint} numberOfLines={1}>
                      {!zone.enabled
                        ? 'Zone is paused'
                        : isInside
                          ? 'You’re inside this zone'
                          : distance !== null
                            ? `${formatDistance(distance)} away`
                            : 'Waiting for a location fix'}
                    </SypauText>
                  </View>
                </View>
              </View>
            </Pressable>
          </DarkCard>
        );
      })}

      <SypauText variant="bodySm" color={SypauColor.boneFaint} align="center">
        Long press a zone to duplicate, pause or delete it.
      </SypauText>

      <SypauConfirmDialog
        visible={menuZone !== null && pendingDelete === null}
        title={menuZone?.name ?? ''}
        message="What would you like to do with this zone?"
        confirmLabel="Edit"
        cancelLabel="Close"
        onCancel={() => setMenuZone(null)}
        onConfirm={() => {
          const zone = menuZone;
          setMenuZone(null);
          if (zone) router.push({ pathname: '/zones/[id]/edit', params: { id: zone.id } });
        }}>
        <View style={styles.menuActions}>
          <MenuAction
            icon="copy"
            label="Duplicate"
            onPress={() => {
              if (menuZone) duplicate(menuZone.id);
              setMenuZone(null);
            }}
          />
          <MenuAction
            icon="pause"
            label={menuZone?.enabled ? 'Pause zone' : 'Resume zone'}
            onPress={() => {
              if (menuZone) setEnabled(menuZone.id, !menuZone.enabled);
              setMenuZone(null);
            }}
          />
          <MenuAction
            icon="trash"
            label="Delete"
            destructive
            onPress={() => setPendingDelete(menuZone)}
          />
        </View>
      </SypauConfirmDialog>

      <SypauConfirmDialog
        visible={pendingDelete !== null}
        destructive
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        message="The boundary and its history go with it. The profile it used stays."
        confirmLabel="Delete zone"
        onCancel={() => {
          setPendingDelete(null);
          setMenuZone(null);
        }}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete.id);
          setPendingDelete(null);
          setMenuZone(null);
        }}
      />
    </SypauScaffold>
  );
}

/** Circles report their radius; a drawn shape, the circle Android watches for it. */
function effectiveRadius(zone: Zone): number {
  if (zone.geometry.type === 'circle') return zone.geometry.radiusMeters;
  return boundingCircle(zone.geometry.points)?.radiusMeters ?? 0;
}

/** The round map button from the zones reference, opening every zone on one map. */
function CoverageButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show all zones on the map"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.coverageButton, pressed && styles.pressed]}>
      <SypauIcon name="map" size={20} />
      <View style={styles.coverageDot} />
    </Pressable>
  );
}

function MenuAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: 'copy' | 'pause' | 'trash';
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? SypauColor.red : SypauColor.bone;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuAction, pressed && styles.pressed]}>
      <SypauIcon name={icon} size={18} color={color} />
      <SypauText variant="label" caps color={color}>
        {label}
      </SypauText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { gap: SypauSpace.xs, paddingTop: SypauSpace.sm, minHeight: 170 },
  // Tucked into the corner so it sits behind the title, clear of the tagline.
  headingArt: {
    position: 'absolute',
    right: -SypauSpace.gutter - 10,
    top: -SypauSpace.xl,
    width: 170,
    height: 130,
    opacity: 0.8,
  },
  headingHand: { marginTop: SypauSpace.sm },
  headingBody: { maxWidth: 240 },

  cardRow: { flexDirection: 'row', gap: SypauSpace.md },
  thumbnailWrap: { width: 112 },
  thumbnail: { width: 112, height: 112, borderRadius: SypauRadius.chip },
  iconBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SypauColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: SypauSpace.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SypauSpace.sm },
  cardTitleText: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingTop: SypauSpace.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },

  coverageButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SypauColor.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverageDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: SypauColor.red,
  },

  menuActions: { gap: SypauSpace.xs, marginTop: SypauSpace.sm },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
  },
  pressed: { opacity: 0.7 },
});
