import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { RedButton, StatusChip } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { ProfileEffectRows } from '@/components/sypau/profileEffects';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SectionTitle, SypauText } from '@/components/sypau/text';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { listEventsForZone } from '@/db/events';
import { distanceToGeometry, geometryArea } from '@/engine/geo';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import { formatArea, formatDistance } from '@/utils/geometry';

export default function ZoneDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const zone = useZoneStore((s) => s.byId(id));
  const setEnabled = useZoneStore((s) => s.setEnabled);
  const remove = useZoneStore((s) => s.remove);
  const profileById = useProfileStore((s) => s.byId);

  const engine = useEngineStore((s) => s.engine);
  const fix = useEngineStore((s) => s.fix);
  const capabilities = useEngineStore((s) => s.capabilities);

  const [pendingDelete, setPendingDelete] = useState(false);

  const events = useMemo(() => (zone ? listEventsForZone(zone.id, 6) : []), [zone?.id, engine]);

  if (!zone) {
    return (
      <SypauScaffold title="Zone Detail" showBack>
        <SypauText variant="body" color={SypauColor.boneMuted}>
          This zone no longer exists.
        </SypauText>
      </SypauScaffold>
    );
  }

  const profile = profileById(zone.profileId);
  const exitProfile = profileById(zone.exitProfileId);
  const isInside = engine.matchedZoneIds.includes(zone.id);
  const isActive = engine.activeZoneId === zone.id;
  const distance = fix ? distanceToGeometry(fix.point, zone.geometry) : null;

  const state = !zone.enabled ? 'Disabled' : isActive ? 'Active' : isInside ? 'Inside' : 'Inactive';
  const stateTone = !zone.enabled ? 'red' : isActive || isInside ? 'green' : 'neutral';

  return (
    <SypauScaffold title="Zone Detail" showBack>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Display>{zone.name}</Display>
          <StatusChip label={state} tone={stateTone} />

          <SypauText variant="hand" color={SypauColor.bone}>
            You are{' '}
            <SypauText variant="hand" color={SypauColor.red}>
              {isInside ? 'inside' : 'outside'}
            </SypauText>{' '}
            this zone
          </SypauText>
          <HandUnderline width={150} />

          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            {zone.enabled
              ? 'SYPAU is watching this boundary and will apply your profile when you cross it.'
              : 'This zone is paused. Nothing will happen when you cross it.'}
          </SypauText>
        </View>

        <View style={styles.heroMap}>
          <ZoneMap
            geometries={[{ id: zone.id, geometry: zone.geometry, muted: !zone.enabled }]}
            userLocation={fix?.point ?? null}
            interactive={false}
            zoom={13}
            style={styles.mapPreview}
          />
          <View style={styles.mapCaption}>
            <SypauIcon name="target" size={13} color={SypauColor.boneMuted} />
            <SypauText variant="bodySm" color={SypauColor.boneMuted}>
              {zone.geometry.type === 'circle'
                ? `${Math.round(zone.geometry.radiusMeters)} m radius`
                : formatArea(geometryArea(zone.geometry))}
            </SypauText>
          </View>
        </View>
      </View>

      <View style={styles.factRow}>
        <Fact label="Boundary" value={zone.boundaryType} />
        <Fact
          label="Distance"
          value={distance === null ? '—' : isInside ? 'Inside' : formatDistance(distance)}
        />
        <Fact label="Priority" value={String(zone.priority)} />
      </View>

      <View style={styles.factRow}>
        <Fact label="Last entered" value={formatMoment(zone.lastEnteredAt)} />
        <Fact label="Last exited" value={formatMoment(zone.lastExitedAt)} />
      </View>

      <SectionTitle>Profile</SectionTitle>
      {profile ? (
        <DarkCard
          onPress={() => router.push({ pathname: '/profiles/[id]', params: { id: profile.id } })}>
          <View style={styles.profileHeader}>
            <SypauIcon name={profile.icon} size={20} color={SypauColor.cyan} />
            <SypauText variant="cardTitle" caps style={styles.flex}>
              {profile.name}
            </SypauText>
            <SypauIcon name="chevron" size={18} color={SypauColor.boneFaint} />
          </View>

          <ProfileEffectRows config={profile.config} capabilities={capabilities} />
        </DarkCard>
      ) : (
        <DarkCard>
          <SypauText variant="body" color={SypauColor.amber}>
            The profile this zone used was deleted. Edit the zone to pick another.
          </SypauText>
        </DarkCard>
      )}

      <SectionTitle>Zone rule</SectionTitle>
      <DarkCard>
        <RuleRow
          icon="pin"
          title="When I enter"
          value={profile ? `Activate ${profile.name}` : 'No profile set'}
        />
        <RuleRow
          icon="back"
          title="When I exit"
          value={exitRuleText(zone.exitBehavior, exitProfile?.name ?? null)}
        />
        {zone.activationDelaySeconds > 0 ? (
          <RuleRow
            icon="clock"
            title="Activation delay"
            value={`After ${zone.activationDelaySeconds}s inside`}
          />
        ) : null}
        {zone.exitDelaySeconds > 0 ? (
          <RuleRow
            icon="clock"
            title="Release delay"
            value={`After ${zone.exitDelaySeconds}s outside`}
          />
        ) : null}
      </DarkCard>

      <SectionTitle>Recent activity</SectionTitle>
      <DarkCard>
        {events.length === 0 ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            Nothing logged for this zone yet.
          </SypauText>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <SypauIcon
                name={event.severity === 'error' ? 'alert' : 'check'}
                size={14}
                color={event.severity === 'error' ? SypauColor.red : SypauColor.cyan}
              />
              <SypauText variant="bodySm" style={styles.flex}>
                {event.title}
              </SypauText>
              <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                {formatMoment(event.timestamp)}
              </SypauText>
            </View>
          ))
        )}
      </DarkCard>

      <View style={styles.actions}>
        <RedButton
          label="Edit"
          variant="outline"
          onPress={() => router.push({ pathname: '/zones/[id]/edit', params: { id: zone.id } })}
          style={styles.flex}
        />
        <RedButton
          label={zone.enabled ? 'Pause' : 'Resume'}
          variant="outline"
          onPress={() => setEnabled(zone.id, !zone.enabled)}
          style={styles.flex}
        />
      </View>

      <RedButton label="Delete zone" onPress={() => setPendingDelete(true)} />

      <SypauConfirmDialog
        visible={pendingDelete}
        destructive
        title={`Delete ${zone.name}?`}
        message="The boundary and its history go with it. The profile it used stays."
        confirmLabel="Delete zone"
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          setPendingDelete(false);
          remove(zone.id);
          router.replace('/zones');
        }}
      />
    </SypauScaffold>
  );
}

function exitRuleText(behavior: string, profileName: string | null): string {
  switch (behavior) {
    case 'defaultProfile':
      return 'Activate your default profile';
    case 'specificProfile':
      return profileName ? `Activate ${profileName}` : 'Activate a chosen profile';
    case 'nothing':
      return 'Leave the device as it is';
    default:
      return 'Restore what SYPAU changed';
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <DarkCard style={styles.fact}>
      <SypauText variant="section" caps color={SypauColor.boneFaint}>
        {label}
      </SypauText>
      <SypauText variant="label" caps>
        {value}
      </SypauText>
    </DarkCard>
  );
}

function RuleRow({
  icon,
  title,
  value,
}: {
  icon: import('@/components/sypau/icon').SypauIconName;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <SypauIcon name={icon} size={16} color={SypauColor.red} />
      <View style={styles.flex}>
        <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
          {title}
        </SypauText>
        <SypauText variant="body">{value}</SypauText>
      </View>
    </View>
  );
}

function formatMoment(timestamp: number | null): string {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: SypauSpace.md },
  heroText: { flex: 1, gap: SypauSpace.xs },
  heroMap: { width: 150, gap: SypauSpace.xs },
  mapPreview: { height: 150, borderRadius: SypauRadius.chip },
  mapCaption: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.xs },

  factRow: { flexDirection: 'row', gap: SypauSpace.sm },
  fact: { flex: 1, gap: SypauSpace.xs },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginBottom: SypauSpace.md,
  },

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.sm,
  },

  actions: { flexDirection: 'row', gap: SypauSpace.md },
});
