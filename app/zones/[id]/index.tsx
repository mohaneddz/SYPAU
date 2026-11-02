import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { goToTab } from '@/components/sypau/bottomNav';
import { DarkCard } from '@/components/sypau/cards';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { HandUnderline, RedCross } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { blockedEffectCount, NumberedEffectRows } from '@/components/sypau/profileEffects';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { listEventsForZone } from '@/db/events';
import { distanceToEdge, geometryArea } from '@/engine/geo';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import { boundingCircle, formatArea, formatDistance } from '@/utils/geometry';
import type { Zone } from '@/types/zone';

export default function ZoneDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const zone = useZoneStore((s) => s.byId(id));
  const zones = useZoneStore((s) => s.zones);
  const setEnabled = useZoneStore((s) => s.setEnabled);
  const remove = useZoneStore((s) => s.remove);
  const profileById = useProfileStore((s) => s.byId);
  const automationEnabled = useSettingsStore((s) => s.settings.automationEnabled);

  const engine = useEngineStore((s) => s.engine);
  const fix = useEngineStore((s) => s.fix);
  const capabilities = useEngineStore((s) => s.capabilities);

  const [pendingDelete, setPendingDelete] = useState(false);

  // Keyed on the active zone and the matched set rather than the whole engine
  // object, which changes on every fix and would re-query the log each time.
  const events = useMemo(
    () => (zone ? listEventsForZone(zone.id, 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zone?.id, engine.activeZoneId, engine.matchedZoneIds.join()]
  );

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
  // Inside but outranked: another, higher-priority zone holds the phone.
  const outranked = isInside && !isActive && engine.activeZoneId !== null;
  const outrankedBy = outranked
    ? zones.find((entry) => entry.id === engine.activeZoneId)
    : null;
  const edge = fix ? distanceToEdge(fix.point, zone.geometry) : null;
  const blocked = profile ? blockedEffectCount(profile.config, capabilities) : 0;

  const state = !zone.enabled
    ? { label: 'Paused', color: SypauColor.red }
    : isActive
      ? { label: 'Active', color: SypauColor.green }
      : isInside
        ? { label: 'Standing by', color: SypauColor.amber }
        : { label: 'Armed', color: SypauColor.cyan };

  const description = !zone.enabled
    ? 'This zone is paused. Nothing happens when you cross it until you resume it.'
    : !automationEnabled
      ? 'SYPAU is switched off in Settings, so this zone is only being watched.'
      : outrankedBy
        ? `${outrankedBy.name} has higher priority here, so it holds your phone while you're in both.`
        : 'This zone is monitoring its boundary and will apply your profile when you cross it.';

  return (
    <SypauScaffold title="Zone Detail" showBack>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <View style={styles.nameCross}>
            <RedCross size={20} />
          </View>
          {/* A single word gets one line: allowed two, Android splits it mid-word
              rather than shrinking it. */}
          <Display
            numberOfLines={/\s/.test(zone.name.trim()) ? 2 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.4}>
            {zone.name}
          </Display>

          <View style={styles.stateRow}>
            <GlowDot color={state.color} live={zone.enabled && (isActive || isInside)} />
            <SypauText variant="cardTitle" caps color={state.color}>
              {state.label}
            </SypauText>
          </View>

          <SypauText variant="handSm" caps color={SypauColor.bone}>
            You are{' '}
            <SypauText variant="handSm" caps color={SypauColor.red}>
              {fix ? (isInside ? 'inside' : 'outside') : 'somewhere'}
            </SypauText>{' '}
            this zone
          </SypauText>
          <HandUnderline width={120} />

          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            {description}
          </SypauText>
        </View>

        <View style={styles.heroMap}>
          <ZoneMap
            geometries={[{ id: zone.id, geometry: zone.geometry, muted: !zone.enabled }]}
            userLocation={fix?.point ?? null}
            interactive={false}
            fitPadding={16}
            style={styles.mapPreview}
          />
          <View style={styles.mapCaption}>
            <SypauIcon name="locate" size={14} color={SypauColor.boneMuted} />
            <SypauText
              variant="labelSm"
              caps
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              color={SypauColor.boneMuted}
              style={styles.flex}>
              {radiusCaption(zone)}
            </SypauText>
          </View>
        </View>
      </View>

      <View style={styles.pair}>
        <DarkCard style={styles.flex}>
          <SypauText variant="label" caps color={SypauColor.boneMuted}>
            Categories
          </SypauText>
          <View style={styles.categories}>
            <Category icon="polygon" label={zone.boundaryType} />
            <Category
              icon="dnd"
              label={profile?.name ?? 'No profile'}
              color={profile ? SypauColor.amber : SypauColor.boneFaint}
            />
            <Category icon="shield" label={`Priority ${zone.priority}`} />
          </View>
        </DarkCard>

        <DarkCard style={styles.flex}>
          <SypauText variant="label" caps color={SypauColor.boneMuted}>
            History
          </SypauText>
          <View style={styles.history}>
            <SypauIcon name="clock" size={26} color={SypauColor.red} />
            <View style={styles.flex}>
              <SypauText variant="label" caps numberOfLines={1}>
                In · {formatMoment(zone.lastEnteredAt)}
              </SypauText>
              <SypauText variant="label" caps color={SypauColor.boneMuted} numberOfLines={1}>
                Out · {formatMoment(zone.lastExitedAt)}
              </SypauText>
            </View>
          </View>
        </DarkCard>
      </View>

      <DarkCard>
        <View style={styles.cardHead}>
          <SypauText variant="label" caps color={SypauColor.boneMuted} style={styles.flex}>
            Auto-trigger
          </SypauText>
          {edge !== null ? (
            <View style={styles.inline}>
              <SypauIcon name="target" size={14} color={SypauColor.boneMuted} />
              <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
                {formatDistance(edge)} to edge
              </SypauText>
            </View>
          ) : null}
        </View>

        <TriggerRow
          title="Entry detection"
          body={
            profile
              ? `Apply ${profile.name} ${delayPhrase(zone.activationDelaySeconds, 'inside')}.`
              : 'No profile is set, so entering does nothing.'
          }
          armed={zone.enabled && profile !== null}
        />
        <TriggerRow
          title="Exit detection"
          body={`${exitRuleText(zone.exitBehavior, exitProfile?.name ?? null)} ${delayPhrase(zone.exitDelaySeconds, 'outside')}.`}
          armed={zone.enabled}
          divided
        />
      </DarkCard>

      <DarkCard>
        <View style={styles.cardHead}>
          <SypauText variant="label" caps color={SypauColor.boneMuted} style={styles.flex}>
            Actions (in order)
          </SypauText>
          {profile ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open the ${profile.name} profile`}
              hitSlop={8}
              onPress={() => router.push({ pathname: '/profiles/[id]', params: { id: profile.id } })}
              style={styles.inline}>
              <SypauText variant="labelSm" caps color={SypauColor.cyan}>
                {profile.name}
              </SypauText>
              <SypauIcon name="chevron" size={14} color={SypauColor.cyan} />
            </Pressable>
          ) : null}
        </View>

        {blocked > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/permissions')}
            style={({ pressed }) => [styles.blockedBanner, pressed && styles.pressed]}>
            <SypauIcon name="lock" size={16} color={SypauColor.amber} />
            <SypauText variant="bodySm" color={SypauColor.bone} style={styles.flex}>
              {blocked === 1 ? 'One action is' : `${blocked} actions are`} waiting on a permission.
              SYPAU won&rsquo;t pretend it applied {blocked === 1 ? 'it' : 'them'}.
            </SypauText>
            <SypauText variant="labelSm" caps color={SypauColor.amber}>
              Fix
            </SypauText>
          </Pressable>
        ) : null}

        {profile ? (
          <NumberedEffectRows config={profile.config} capabilities={capabilities} />
        ) : (
          <SypauText variant="body" color={SypauColor.amber}>
            The profile this zone used was deleted. Edit the zone to pick another.
          </SypauText>
        )}
      </DarkCard>

      <DarkCard>
        <SypauText variant="label" caps color={SypauColor.boneMuted}>
          Recent activity
        </SypauText>
        {events.length === 0 ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint} style={styles.eventsEmpty}>
            Nothing logged for this zone yet.
          </SypauText>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <SypauIcon
                name={event.severity === 'error' ? 'alert' : event.severity === 'warning' ? 'lock' : 'check'}
                size={14}
                color={
                  event.severity === 'error'
                    ? SypauColor.red
                    : event.severity === 'warning'
                      ? SypauColor.amber
                      : SypauColor.cyan
                }
              />
              <SypauText variant="bodySm" style={styles.flex} numberOfLines={1}>
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
        <ActionButton
          icon="edit"
          label="Edit"
          onPress={() => router.push({ pathname: '/zones/[id]/edit', params: { id: zone.id } })}
        />
        <ActionButton
          icon={zone.enabled ? 'pause' : 'zap'}
          label={zone.enabled ? 'Pause' : 'Resume'}
          onPress={() => setEnabled(zone.id, !zone.enabled)}
        />
        <ActionButton icon="close" label="Delete" destructive onPress={() => setPendingDelete(true)} />
      </View>

      <SypauConfirmDialog
        visible={pendingDelete}
        destructive
        icon="trash"
        title={`Delete ${zone.name}?`}
        message="The boundary and its history go with it. The profile it used stays. If you're inside it, SYPAU hands back what it changed straight away."
        confirmLabel="Delete zone"
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          setPendingDelete(false);
          remove(zone.id);
          goToTab('/zones');
        }}
      />
    </SypauScaffold>
  );
}

/** The status light. Pulses while the zone has the phone, steady otherwise. */
function GlowDot({ color, live }: { color: string; live: boolean }) {
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!live || reducedMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
  }, [live, pulse, reducedMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  return (
    <View style={styles.glow}>
      <Animated.View style={[styles.glowHalo, { backgroundColor: color }, haloStyle]} />
      <View style={[styles.glowCore, { backgroundColor: color, shadowColor: color }]} />
    </View>
  );
}

function Category({
  icon,
  label,
  color = SypauColor.cyan,
}: {
  icon: SypauIconName;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.category}>
      <SypauIcon name={icon} size={24} color={color} />
      <SypauText
        variant="labelSm"
        caps
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        align="center">
        {label}
      </SypauText>
    </View>
  );
}

function TriggerRow({
  title,
  body,
  armed,
  divided = false,
}: {
  title: string;
  body: string;
  armed: boolean;
  divided?: boolean;
}) {
  return (
    <View style={[styles.trigger, divided && styles.triggerDivided]}>
      <SypauIcon name="target" size={30} color={SypauColor.red} />
      <View style={styles.flex}>
        <SypauText variant="label" caps>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {body}
        </SypauText>
      </View>
      <View style={[styles.armedBox, !armed && styles.armedBoxOff]}>
        <SypauText variant="labelSm" caps color={armed ? SypauColor.red : SypauColor.boneFaint}>
          {armed ? 'Armed' : 'Off'}
        </SypauText>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: SypauIconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} zone`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        destructive && styles.actionDestructive,
        pressed && styles.pressed,
      ]}>
      {destructive ? <Grain opacity={0.18} /> : null}
      <SypauIcon name={icon} size={18} color={SypauColor.bone} />
      <SypauText variant="label" caps>
        {label}
      </SypauText>
    </Pressable>
  );
}

function radiusCaption(zone: Zone): string {
  if (zone.geometry.type === 'circle') return `${Math.round(zone.geometry.radiusMeters)}m radius`;
  const circle = boundingCircle(zone.geometry.points);
  // A polygon has no radius; its width across reads truer than the bounding
  // circle's radius did.
  return circle
    ? `${Math.round(circle.radiusMeters * 2)}m wide · ${formatArea(geometryArea(zone.geometry))}`
    : '—';
}

function delayPhrase(seconds: number, where: 'inside' | 'outside'): string {
  return seconds > 0 ? `after ${seconds}s ${where}` : 'straight away';
}

function exitRuleText(behavior: string, profileName: string | null): string {
  switch (behavior) {
    case 'defaultProfile':
      return 'Switch to your default profile';
    case 'specificProfile':
      return profileName ? `Switch to ${profileName}` : 'Switch to a chosen profile';
    case 'nothing':
      return 'Leave the phone as it is';
    default:
      return 'Hand back what SYPAU changed';
  }
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.xs },
  pressed: { opacity: 0.75 },

  hero: { flexDirection: 'row', gap: SypauSpace.md },
  heroText: { flex: 1, gap: SypauSpace.xs },
  nameCross: { marginLeft: SypauSpace.xxl * 2, marginBottom: -SypauSpace.md, zIndex: 1 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },
  heroMap: { width: 160, gap: 0 },
  mapPreview: {
    height: 170,
    borderTopLeftRadius: SypauRadius.chip,
    borderTopRightRadius: SypauRadius.chip,
  },
  mapCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.xs,
    paddingHorizontal: SypauSpace.sm,
    paddingVertical: SypauSpace.sm,
    backgroundColor: SypauColor.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderBottomLeftRadius: SypauRadius.chip,
    borderBottomRightRadius: SypauRadius.chip,
  },

  glow: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  glowHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  glowCore: {
    width: 11,
    height: 11,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  pair: { flexDirection: 'row', gap: SypauSpace.md },
  categories: { flexDirection: 'row', marginTop: SypauSpace.md, gap: SypauSpace.xs },
  category: { flex: 1, alignItems: 'center', gap: SypauSpace.xs },
  history: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md, marginTop: SypauSpace.md },

  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: SypauSpace.sm },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md, paddingVertical: SypauSpace.sm },
  triggerDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SypauColor.hairline },
  armedBox: {
    borderWidth: 1,
    borderColor: SypauColor.red,
    borderRadius: 2,
    paddingHorizontal: SypauSpace.sm,
    paddingVertical: 3,
  },
  armedBoxOff: { borderColor: SypauColor.hairline },

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    padding: SypauSpace.md,
    marginBottom: SypauSpace.sm,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.amber,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },

  eventsEmpty: { marginTop: SypauSpace.sm },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.sm,
  },

  actions: { flexDirection: 'row', gap: SypauSpace.sm },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.lg,
    borderRadius: SypauRadius.button,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.surface,
    overflow: 'hidden',
  },
  actionDestructive: { backgroundColor: SypauColor.red, borderColor: SypauColor.red },
});
