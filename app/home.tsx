import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { DarkCard, PaperCard } from '@/components/sypau/cards';
import { StatusChip } from '@/components/sypau/controls';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { geometryArea } from '@/engine/geo';
import { countEventsSince } from '@/db/events';
import { useActivityStore } from '@/state/useActivityStore';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import { formatArea } from '@/utils/geometry';

export default function HomeRoute() {
  const engine = useEngineStore((s) => s.engine);
  const fix = useEngineStore((s) => s.fix);
  const zones = useZoneStore((s) => s.zones);
  const profileById = useProfileStore((s) => s.byId);
  const settings = useSettingsStore((s) => s.settings);
  const events = useActivityStore((s) => s.events);
  const loadActivity = useActivityStore((s) => s.load);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const activeZone = zones.find((zone) => zone.id === engine.activeZoneId) ?? null;
  const activeProfile = profileById(
    activeZone?.profileId ?? settings.defaultProfileId ?? null
  );
  const fallbackProfile = profileById(settings.defaultProfileId) ?? null;

  const matchedZones = engine.matchedZoneIds
    .map((id) => zones.find((zone) => zone.id === id))
    .filter((zone): zone is NonNullable<typeof zone> => zone != null);

  const todayCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return countEventsSince(startOfDay.getTime());
  }, [events.length]);

  const latestEvent = events[0] ?? null;

  return (
    <SypauScaffold
      wordmark="hero"
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activity"
          hitSlop={10}
          onPress={() => router.push('/activity')}>
          <SypauIcon name="bell" size={22} />
          {todayCount > 0 ? <View style={styles.bellDot} /> : null}
        </Pressable>
      }>
      <SypauText variant="hand" color={SypauColor.red} align="center">
        You set the silence.{'\n'}We keep it that way.
      </SypauText>

      <StateCard
        zoneName={activeZone?.name ?? null}
        profileName={activeProfile?.name ?? null}
        automationEnabled={settings.automationEnabled}
        reducedMotion={settings.reducedMotion}
      />

      <EffectsStrip profileConfig={activeProfile?.config ?? null} />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/zones/create')}
        style={({ pressed }) => [styles.createBanner, pressed && styles.pressed]}>
        <Grain opacity={0.2} />
        <Image source={SypauAsset.emblem} style={styles.bannerEmblem} contentFit="contain" />
        <View style={styles.bannerText}>
          <SypauText variant="hand" caps color={SypauColor.bone} style={styles.bannerTitle}>
            Create Zone
          </SypauText>
          <SypauText variant="labelSm" caps color="rgba(236,234,230,0.82)">
            Draw your boundary.
          </SypauText>
        </View>
        <SypauIcon name="chevron" size={24} color={SypauColor.bone} />
      </Pressable>

      <View style={styles.summaryRow}>
        <CurrentZoneCard
          zone={activeZone}
          hasZones={zones.length > 0}
          userPoint={fix?.point ?? null}
        />
        <SilenceTimeCard activeSince={engine.activeSince} />
      </View>

      {matchedZones.length > 1 ? (
        <DarkCard onPress={() => router.push('/zones')}>
          <View style={styles.overlapHeader}>
            <SypauText variant="section" caps color={SypauColor.cyan}>
              Overlapping zones
            </SypauText>
            <SypauIcon name="chevron" size={16} color={SypauColor.boneFaint} />
          </View>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            You&rsquo;re inside {matchedZones.length} zones. {matchedZones[0].name} wins on priority.
          </SypauText>
        </DarkCard>
      ) : null}

      <DarkCard onPress={() => router.push('/activity')}>
        <View style={styles.overlapHeader}>
          <SypauText variant="section" caps color={SypauColor.cyan}>
            Activity log
          </SypauText>
          <View style={styles.viewAll}>
            <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
              View all
            </SypauText>
            <SypauIcon name="chevron" size={14} color={SypauColor.boneMuted} />
          </View>
        </View>

        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {todayCount === 0
            ? 'Nothing logged today.'
            : `${todayCount} ${todayCount === 1 ? 'event' : 'events'} today.`}
        </SypauText>

        {latestEvent ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint} style={styles.latest}>
            {latestEvent.title}
          </SypauText>
        ) : null}
      </DarkCard>

      {!activeZone && zones.length > 0 && fallbackProfile ? (
        <SypauText variant="bodySm" color={SypauColor.boneFaint} align="center">
          Outside every zone — {fallbackProfile.name} is your fallback.
        </SypauText>
      ) : null}
    </SypauScaffold>
  );
}

/** The hero: current zone, the huge state word, and the radar pulse. */
function StateCard({
  zoneName,
  profileName,
  automationEnabled,
  reducedMotion,
}: {
  zoneName: string | null;
  profileName: string | null;
  automationEnabled: boolean;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || !zoneName) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, [pulse, reducedMotion, zoneName]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 0.65 + pulse.value * 0.7 }],
  }));

  const state = !automationEnabled ? 'PAUSED' : zoneName ? 'ACTIVE' : 'STANDBY';
  const stateColor = !automationEnabled ? SypauColor.amber : SypauColor.bone;

  const message = !automationEnabled
    ? 'Automation is off.\nNothing will change on its own.'
    : zoneName
      ? 'You’re inside your zone.\nSilence is in control.'
      : 'No zone claims you right now.\nYour phone is yours.';

  return (
    <View style={styles.stateCard}>
      <Grain opacity={0.16} />

      <View style={styles.radar} pointerEvents="none">
        <Animated.View style={pulseStyle}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Circle cx={110} cy={110} r={106} stroke={SypauColor.cyan} strokeWidth={1} fill="none" />
            <Circle cx={110} cy={110} r={74} stroke={SypauColor.cyan} strokeWidth={1} fill="none" />
            <Circle cx={110} cy={110} r={44} stroke={SypauColor.cyan} strokeWidth={1} fill="none" />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.stateBody}>
        <View style={styles.stateText}>
          <SypauText variant="label" caps color={SypauColor.cyan}>
            {zoneName ?? 'No active zone'}
          </SypauText>

          <SypauText variant="hand" caps color={stateColor} style={styles.stateWord}>
            {state}
          </SypauText>
          <HandUnderline width={130} color={SypauColor.cyan} />

          <SypauText variant="body" color={SypauColor.boneMuted} style={styles.stateMessage}>
            {message}
          </SypauText>

          <StatusChip
            label={zoneName ? 'Zone active' : automationEnabled ? 'Watching' : 'Paused'}
            tone={!automationEnabled ? 'amber' : zoneName ? 'cyan' : 'neutral'}
            style={styles.stateChip}
          />

          {profileName ? (
            <SypauText variant="labelSm" caps color={SypauColor.boneFaint}>
              {profileName} profile
            </SypauText>
          ) : null}
        </View>

        <Image source={SypauAsset.emblem} style={styles.stateEmblem} contentFit="contain" />
      </View>
    </View>
  );
}

/** The torn paper strip: what the active profile is actually doing right now. */
function EffectsStrip({
  profileConfig,
}: {
  profileConfig: import('@/types/profile').ProfileConfig | null;
}) {
  const ringerMuted =
    profileConfig?.ringerMode === 'silent' || profileConfig?.ringVolume === 0;
  const notificationsMuted =
    profileConfig?.notificationVolume === 0 ||
    profileConfig?.dndMode === 'priority' ||
    profileConfig?.dndMode === 'alarms' ||
    profileConfig?.dndMode === 'silence';
  // Alarms are only silenced when the profile explicitly says so — never as a
  // side effect of another category being muted.
  const alarmsMuted =
    profileConfig?.alarmVolume === 0 || profileConfig?.dndMode === 'silence';

  const items = [
    { icon: 'bell' as const, label: 'Alarms', muted: alarmsMuted, onLabel: 'Active' },
    { icon: 'phone' as const, label: 'Calls', muted: ringerMuted, onLabel: 'Ringing' },
    { icon: 'message' as const, label: 'Notifications', muted: notificationsMuted, onLabel: 'Active' },
  ];

  return (
    <PaperCard seed={17} contentStyle={styles.stripContent}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.stripItem, index > 0 && styles.stripDivider]}>
          <View>
            <SypauIcon name={item.icon} size={24} color={SypauColor.paperInk} />
            {item.muted ? (
              <View style={styles.mutedBadge}>
                <SypauIcon name="close" size={8} color={SypauColor.bone} />
              </View>
            ) : null}
          </View>
          <View>
            <SypauText variant="labelSm" caps color={SypauColor.paperInk}>
              {item.label}
            </SypauText>
            <SypauText
              variant="labelSm"
              caps
              color={item.muted ? SypauColor.red : SypauColor.cyanDim}>
              {item.muted ? 'Muted' : item.onLabel}
            </SypauText>
          </View>
        </View>
      ))}
    </PaperCard>
  );
}

function CurrentZoneCard({
  zone,
  hasZones,
  userPoint,
}: {
  zone: import('@/types/zone').Zone | null;
  hasZones: boolean;
  userPoint: import('@/engine/geo').LatLng | null;
}) {
  if (!zone) {
    return (
      <DarkCard
        style={styles.summaryCard}
        onPress={() => router.push(hasZones ? '/zones' : '/zones/create')}>
        <SypauText variant="section" caps color={SypauColor.cyan}>
          Current zone
        </SypauText>
        <SypauText variant="cardTitle" caps>
          {hasZones ? 'None' : 'No zones'}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {hasZones ? 'You’re outside them all.' : 'Draw your first boundary.'}
        </SypauText>
      </DarkCard>
    );
  }

  return (
    <DarkCard
      style={styles.summaryCard}
      onPress={() => router.push({ pathname: '/zones/[id]', params: { id: zone.id } })}>
      <SypauText variant="section" caps color={SypauColor.cyan}>
        Current zone
      </SypauText>

      <View style={styles.summaryBody}>
        <View style={styles.summaryText}>
          <SypauText variant="cardTitle" numberOfLines={1}>
            {zone.name}
          </SypauText>
          <View style={styles.areaRow}>
            <SypauIcon name="pin" size={13} color={SypauColor.boneMuted} />
            <SypauText variant="bodySm" color={SypauColor.boneMuted} numberOfLines={1}>
              {formatArea(geometryArea(zone.geometry))}
            </SypauText>
          </View>
        </View>

        <ZoneMap
          geometries={[{ id: zone.id, geometry: zone.geometry }]}
          userLocation={userPoint}
          interactive={false}
          fitPadding={8}
          style={styles.miniMap}
        />
      </View>
    </DarkCard>
  );
}

function SilenceTimeCard({ activeSince }: { activeSince: number | null }) {
  const elapsed = activeSince ? Date.now() - activeSince : 0;
  const hours = Math.floor(elapsed / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);

  // Full ring at 8 hours — long enough that a normal day reads as progress.
  const progress = Math.min(1, elapsed / (8 * 3_600_000));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <DarkCard style={styles.summaryCard}>
      <SypauText variant="section" caps color={SypauColor.cyan}>
        Silence time
      </SypauText>

      <View style={styles.summaryBody}>
        <View style={styles.summaryText}>
          <SypauText variant="cardTitle">
            {activeSince ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`) : '—'}
          </SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            {activeSince ? 'So far' : 'Not active'}
          </SypauText>
        </View>

        <View style={styles.ring}>
          <Svg width={72} height={72} viewBox="0 0 84 84">
            <Circle cx={42} cy={42} r={radius} stroke={SypauColor.hairline} strokeWidth={5} fill="none" />
            {progress > 0 ? (
              <Circle
                cx={42}
                cy={42}
                r={radius}
                stroke={SypauColor.cyan}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference * progress} ${circumference}`}
                transform="rotate(-90 42 42)"
              />
            ) : null}
          </Svg>
          <Image source={SypauAsset.emblem} style={styles.ringEmblem} contentFit="contain" />
        </View>
      </View>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SypauColor.red,
  },

  stateCard: {
    backgroundColor: SypauColor.surface,
    borderRadius: SypauRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    overflow: 'hidden',
    minHeight: 250,
  },
  radar: {
    position: 'absolute',
    right: -30,
    top: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBody: { flexDirection: 'row', alignItems: 'center', padding: SypauSpace.lg },
  stateText: { flex: 1, gap: SypauSpace.xs },
  stateMessage: { marginTop: SypauSpace.sm },
  stateChip: { marginTop: SypauSpace.md },
  stateEmblem: { width: 130, height: 130 },

  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SypauSpace.lg,
    paddingHorizontal: SypauSpace.sm,
  },
  stripItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingHorizontal: SypauSpace.sm,
  },
  // The small red cross the reference pins to a muted category's icon.
  mutedBadge: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: SypauColor.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(20,20,18,0.25)',
  },

  createBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    backgroundColor: SypauColor.red,
    borderRadius: SypauRadius.button,
    paddingVertical: SypauSpace.lg,
    paddingHorizontal: SypauSpace.lg,
    overflow: 'hidden',
  },
  bannerEmblem: { width: 42, height: 42 },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 34, lineHeight: 36 },

  summaryRow: { flexDirection: 'row', gap: SypauSpace.md },
  summaryCard: { flex: 1, gap: SypauSpace.sm },
  summaryBody: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },
  summaryText: { flex: 1, gap: SypauSpace.xs },
  miniMap: { width: 72, height: 72, borderRadius: SypauRadius.chip },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.xs },

  ring: { alignItems: 'center', justifyContent: 'center' },
  ringEmblem: { position: 'absolute', width: 34, height: 34 },

  tagline: { alignItems: 'center', marginTop: -SypauSpace.sm },
  // A slight tilt is what makes the line read as written on, not typeset.
  taglineText: { transform: [{ rotate: '-3deg' }] },
  stateWord: { fontSize: 66, lineHeight: 70, marginBottom: -6 },

  overlapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SypauSpace.xs,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.xs },
  latest: { marginTop: SypauSpace.xs },

  pressed: { opacity: 0.85 },
});
