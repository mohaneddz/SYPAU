import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { StatusChip, SypauSwitch } from '@/components/sypau/controls';
import { SypauConfirmDialog, SypauEmptyState } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SypauText } from '@/components/sypau/text';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { distanceToGeometry } from '@/engine/geo';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import { formatDistance } from '@/utils/geometry';
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
    <SypauScaffold wordmark showBack>
      <View style={styles.heading}>
        <Display>My Zones</Display>
        <HandUnderline width={200} />
        <SypauText variant="hand" color={SypauColor.bone}>
          Your quiet spaces.
        </SypauText>
        <SypauText variant="body" color={SypauColor.boneMuted}>
          Set them. Forget them.
        </SypauText>
      </View>

      {zones.map((zone) => {
        const profile = profileById(zone.profileId);
        const isInside = engine.matchedZoneIds.includes(zone.id);
        const isActive = engine.activeZoneId === zone.id;
        const distance = fix ? distanceToGeometry(fix.point, zone.geometry) : null;

        return (
          <DarkCard key={zone.id} highlighted={isActive}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/zones/[id]', params: { id: zone.id } })}
              onLongPress={() => setMenuZone(zone)}>
              <View style={styles.cardTop}>
                <ZoneMap
                  geometries={[{ id: zone.id, geometry: zone.geometry, muted: !zone.enabled }]}
                  interactive={false}
                  zoom={13}
                  style={styles.thumbnail}
                />

                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.cardTitleText}>
                      <SypauText variant="cardTitle" caps>
                        {zone.name}
                      </SypauText>
                      <StatusChip
                        label={
                          !zone.enabled
                            ? 'Paused'
                            : isActive
                              ? 'Active'
                              : isInside
                                ? 'Inside'
                                : 'Watching'
                        }
                        tone={!zone.enabled ? 'red' : isActive || isInside ? 'cyan' : 'neutral'}
                      />
                    </View>

                    <SypauSwitch
                      value={zone.enabled}
                      onValueChange={(next) => setEnabled(zone.id, next)}
                      accessibilityLabel={`${zone.name} enabled`}
                    />
                  </View>

                  <View style={styles.metaRow}>
                    <SypauIcon name="layers" size={14} color={SypauColor.boneMuted} />
                    <SypauText variant="bodySm" color={SypauColor.boneMuted}>
                      {profile?.name ?? 'Profile missing'}
                    </SypauText>
                  </View>

                  <View style={styles.metaRow}>
                    <SypauIcon name="target" size={14} color={SypauColor.boneMuted} />
                    <SypauText variant="bodySm" color={SypauColor.boneMuted}>
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

            <View style={styles.cardActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More options for ${zone.name}`}
                hitSlop={8}
                onPress={() => setMenuZone(zone)}
                style={styles.moreButton}>
                <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
                  Options
                </SypauText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.push({ pathname: '/zones/[id]', params: { id: zone.id } })}>
                <SypauIcon name="chevron" size={22} color={SypauColor.red} />
              </Pressable>
            </View>
          </DarkCard>
        );
      })}

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
  heading: { gap: SypauSpace.xs },
  cardTop: { flexDirection: 'row', gap: SypauSpace.md },
  thumbnail: { width: 104, height: 104, borderRadius: SypauRadius.chip },
  cardInfo: { flex: 1, gap: SypauSpace.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SypauSpace.sm },
  cardTitleText: { flex: 1, gap: SypauSpace.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SypauSpace.md,
    paddingTop: SypauSpace.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },
  moreButton: { paddingVertical: 2 },
  menuActions: { gap: SypauSpace.xs, marginTop: SypauSpace.sm },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
  },
  pressed: { opacity: 0.7 },
});
