import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { RedButton, StatusChip } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SectionTitle, SypauText } from '@/components/sypau/text';
import { openSettings } from '@/core/nativeBridge';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useEngineStore } from '@/state/useEngineStore';
import type { PermissionKey, PermissionState } from '@/types/capability';
import { getNotifications } from '@/utils/notifications';

type SettingsTarget = Parameters<typeof openSettings>[0];

type Requirement = {
  key: PermissionKey;
  icon: SypauIconName;
  title: string;
  why: string;
  group: 'Location' | 'System control' | 'Reliability';
  /** Zones can't work at all without it. */
  essential: boolean;
  /** Where Android sends us when it can't be granted from a prompt. */
  settings: SettingsTarget;
  /** What to do once there, said before we send anyone off to find it. */
  steps: string;
};

/**
 * In the order worth granting them: location first, because nothing works
 * without it, then the grants that make SYPAU reliable, then the optional one.
 */
const REQUIREMENTS: Requirement[] = [
  {
    key: 'locationForeground',
    icon: 'pin',
    title: 'Precise location',
    why: 'Works out which of your zones you’re standing in.',
    group: 'Location',
    essential: true,
    settings: 'app',
    steps: 'Open Permissions → Location and choose Allow, with Use precise location on.',
  },
  {
    key: 'locationServicesEnabled',
    icon: 'target',
    title: 'Location services',
    why: 'Your phone’s location switch has to be on for anything to know where you are.',
    group: 'Location',
    essential: true,
    settings: 'location',
    steps: 'Turn on Use location, then come back.',
  },
  {
    key: 'locationBackground',
    icon: 'layers',
    title: 'Background location',
    why: 'Lets SYPAU notice a crossing while the app is closed. Without it, zones only work while it’s open.',
    group: 'Location',
    essential: true,
    settings: 'app',
    steps: 'Open Permissions → Location and choose Allow all the time.',
  },
  {
    key: 'notifications',
    icon: 'bell',
    title: 'Notifications',
    why: 'Tells you when a profile takes over or something needs you.',
    group: 'Reliability',
    essential: false,
    settings: 'notifications',
    steps: 'Turn on All SYPAU notifications.',
  },
  {
    key: 'dndAccess',
    icon: 'dnd',
    title: 'Do Not Disturb access',
    why: 'Needed to silence the ringer and switch Do Not Disturb for you.',
    group: 'System control',
    essential: false,
    settings: 'dnd',
    steps: 'Find SYPAU in the list and switch it on. Android will ask you to confirm.',
  },
  {
    key: 'batteryOptimizationExempt',
    icon: 'battery',
    title: 'Battery optimisation',
    why: 'Android may stop SYPAU in the background. Excluding it keeps zones watched.',
    group: 'Reliability',
    essential: false,
    settings: 'batteryOptimization',
    steps: 'Choose Unrestricted (or Don’t optimise) for SYPAU.',
  },
  {
    key: 'writeSystemSettings',
    icon: 'sun',
    title: 'Modify system settings',
    why: 'Only needed if a profile changes brightness, screen timeout or ring vibration.',
    group: 'System control',
    essential: false,
    settings: 'writeSettings',
    steps: 'Switch on Allow modifying system settings for SYPAU.',
  },
];

type PermissionsScreenProps = {
  /** Embedded under Settings, where the "continue" CTA doesn't belong. */
  embedded?: boolean;
};

/**
 * Every requirement in one place: what it is, why SYPAU wants it, and one way
 * forward. Nothing is requested in a batch, a trip to Android settings is
 * explained before it happens, and the app stays usable when optional grants
 * are declined.
 */
export function PermissionsScreen({ embedded = false }: PermissionsScreenProps) {
  const permissions = useEngineStore((s) => s.permissions);
  const capabilities = useEngineStore((s) => s.capabilities);
  const refresh = useEngineStore((s) => s.refreshNativeState);

  const [requesting, setRequesting] = useState<PermissionKey | null>(null);
  const [explaining, setExplaining] = useState<Requirement | null>(null);
  const [justGranted, setJustGranted] = useState<PermissionKey | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Coming back from Android settings is the moment something flips to
  // granted; it deserves to be felt, not just quietly re-rendered.
  const previous = useRef(permissions);
  useEffect(() => {
    const flipped = REQUIREMENTS.find(
      (req) => permissions[req.key].granted && !previous.current[req.key].granted
    );
    previous.current = permissions;
    if (!flipped) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setJustGranted(flipped.key);
    const timer = setTimeout(() => setJustGranted(null), 2400);
    return () => clearTimeout(timer);
  }, [permissions]);

  const sendToSettings = (requirement: Requirement) => setExplaining(requirement);

  const grant = useCallback(
    async (requirement: Requirement) => {
      const state = permissions[requirement.key];
      setRequesting(requirement.key);
      try {
        switch (requirement.key) {
          case 'locationForeground': {
            if (!state.canRequestInApp) return sendToSettings(requirement);
            const result = await Location.requestForegroundPermissionsAsync();
            if (result.status !== 'granted' && !result.canAskAgain) sendToSettings(requirement);
            return;
          }
          case 'locationBackground': {
            // Android grants this only on top of foreground location, and from
            // Android 11 only from Settings — the prompt can't offer "all the time".
            const foreground = await Location.getForegroundPermissionsAsync();
            if (foreground.status !== 'granted') {
              const result = await Location.requestForegroundPermissionsAsync();
              if (result.status !== 'granted') return;
            }
            if (state.canRequestInApp) {
              const result = await Location.requestBackgroundPermissionsAsync();
              if (result.status === 'granted') return;
            }
            return sendToSettings(requirement);
          }
          case 'notifications': {
            // Loaded lazily: a static import throws inside Expo Go.
            const Notifications = await getNotifications();
            if (!Notifications || !state.canRequestInApp) return sendToSettings(requirement);
            const result = await Notifications.requestPermissionsAsync();
            // After two refusals Android stops showing the prompt at all, so a
            // tap that silently did nothing becomes a trip to Settings.
            if (!result.granted && !result.canAskAgain) sendToSettings(requirement);
            return;
          }
          default:
            return sendToSettings(requirement);
        }
      } finally {
        setRequesting(null);
        refresh();
      }
    },
    [permissions, refresh]
  );

  const pending = REQUIREMENTS.filter((req) => !permissions[req.key].granted);
  const ready = REQUIREMENTS.filter((req) => permissions[req.key].granted);
  const essentialsReady = REQUIREMENTS.filter((req) => req.essential).every(
    (req) => permissions[req.key].granted
  );
  const next = pending[0] ?? null;
  // Groups appear in the order their first item would be granted, so the
  // list reads top to bottom in the same order "Next" walks through it.
  const groups = [...new Set(pending.map((req) => req.group))].map((group) => ({
    group,
    items: pending.filter((req) => req.group === group),
  }));

  return (
    <SypauScaffold
      title={embedded ? 'Permissions' : undefined}
      wordmark={!embedded}
      showBack={embedded}
      showNav={embedded}>
      {!embedded ? (
        <View style={styles.intro}>
          <Display>Set up access</Display>
          <HandUnderline width={180} />
          <SypauText variant="body" color={SypauColor.boneMuted}>
            SYPAU only asks for what it needs to notice a boundary and act on it. Each one says why.
          </SypauText>
        </View>
      ) : null}

      <ProgressCard
        permissions={permissions}
        next={next}
        busy={requesting !== null}
        essentialsReady={essentialsReady}
        onGrantNext={() => next && void grant(next)}
      />

      {groups.map(({ group, items }) => (
        <View key={group} style={styles.group}>
          <SectionTitle>{group}</SectionTitle>
          {items.map((requirement) => (
            <PendingRow
              key={requirement.key}
              requirement={requirement}
              state={permissions[requirement.key]}
              busy={requesting === requirement.key}
              onGrant={() => void grant(requirement)}
            />
          ))}
        </View>
      ))}

      {ready.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>Ready</SectionTitle>
          <DarkCard>
            {ready.map((requirement, index) => (
              <View
                key={requirement.key}
                style={[styles.readyRow, index > 0 && styles.readyDivider]}
                accessible
                accessibilityLabel={`${requirement.title}: granted`}>
                <SypauIcon name="check" size={18} color={SypauColor.cyan} />
                <SypauText variant="bodyMedium" style={styles.flex}>
                  {requirement.title}
                </SypauText>
                {justGranted === requirement.key ? (
                  <StatusChip label="Granted" tone="green" />
                ) : (
                  <SypauIcon name={requirement.icon} size={16} color={SypauColor.boneFaint} />
                )}
              </View>
            ))}
          </DarkCard>
        </View>
      ) : null}

      {capabilities.dnd.status === 'unsupported' ? (
        <SypauText variant="bodySm" color={SypauColor.amber}>
          System control isn&rsquo;t available in this build. Zones and profiles still work, but
          SYPAU can&rsquo;t change your phone until you run a development build.
        </SypauText>
      ) : null}

      {!embedded ? (
        <RedButton
          label={essentialsReady ? 'Start using SYPAU' : 'Continue anyway'}
          sublabel={essentialsReady ? undefined : 'Zones need location to work'}
          onPress={() => router.replace('/home')}
        />
      ) : null}

      <SypauConfirmDialog
        visible={explaining !== null}
        icon={explaining?.icon}
        title={explaining?.title ?? ''}
        message={
          explaining
            ? `Android handles this one in its own settings. ${explaining.steps} SYPAU picks it up as soon as you come back.`
            : ''
        }
        confirmLabel="Open settings"
        cancelLabel="Not now"
        onCancel={() => setExplaining(null)}
        onConfirm={() => {
          const target = explaining?.settings;
          setExplaining(null);
          if (target && !openSettings(target)) openSettings('app');
        }}
      />
    </SypauScaffold>
  );
}

function ProgressCard({
  permissions,
  next,
  busy,
  essentialsReady,
  onGrantNext,
}: {
  permissions: Record<PermissionKey, PermissionState>;
  next: Requirement | null;
  busy: boolean;
  essentialsReady: boolean;
  onGrantNext: () => void;
}) {
  const grantedCount = REQUIREMENTS.filter((req) => permissions[req.key].granted).length;

  return (
    <DarkCard highlighted={next === null}>
      <View style={styles.progressHead}>
        <View style={styles.flex}>
          <SypauText variant="label" caps color={SypauColor.boneMuted}>
            {next === null
              ? 'All set'
              : essentialsReady
                ? 'Zones are working'
                : 'Zones can’t work yet'}
          </SypauText>
          <SypauText variant="displaySm">
            {grantedCount}
            <SypauText variant="cardTitle" color={SypauColor.boneMuted}>
              {' '}
              / {REQUIREMENTS.length} ready
            </SypauText>
          </SypauText>
        </View>
        <SypauIcon
          name={next === null ? 'check' : essentialsReady ? 'shield' : 'alert'}
          size={30}
          color={
            next === null ? SypauColor.cyan : essentialsReady ? SypauColor.cyan : SypauColor.amber
          }
        />
      </View>

      <View style={styles.segments} accessibilityElementsHidden>
        {[...REQUIREMENTS]
          .sort((a, b) => Number(permissions[b.key].granted) - Number(permissions[a.key].granted))
          .map((req) => (
            <View
              key={req.key}
              style={[
                styles.segment,
                permissions[req.key].granted
                  ? styles.segmentDone
                  : req.essential
                    ? styles.segmentEssential
                    : null,
              ]}
            />
          ))}
      </View>

      {next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Grant next: ${next.title}`}
          disabled={busy}
          onPress={onGrantNext}
          style={({ pressed }) => [styles.nextButton, (pressed || busy) && styles.pressed]}>
          <SypauIcon name={next.icon} size={18} color={SypauColor.bone} />
          <SypauText variant="label" caps style={styles.flex}>
            {busy ? 'Asking…' : `Next: ${next.title}`}
          </SypauText>
          <SypauIcon name="chevron" size={18} color={SypauColor.bone} />
        </Pressable>
      ) : null}
    </DarkCard>
  );
}

function PendingRow({
  requirement,
  state,
  busy,
  onGrant,
}: {
  requirement: Requirement;
  state: PermissionState;
  busy: boolean;
  onGrant: () => void;
}) {
  const viaSettings =
    !state.canRequestInApp ||
    !['locationForeground', 'locationBackground', 'notifications'].includes(requirement.key);

  return (
    <DarkCard>
      <View style={styles.pendingRow}>
        <View style={[styles.pendingIcon, requirement.essential && styles.pendingIconEssential]}>
          <SypauIcon
            name={requirement.icon}
            size={20}
            color={requirement.essential ? SypauColor.amber : SypauColor.boneMuted}
          />
        </View>
        <View style={styles.flex}>
          <View style={styles.pendingTitle}>
            <SypauText variant="label" caps style={styles.flex}>
              {requirement.title}
            </SypauText>
            {requirement.essential ? (
              <SypauText variant="labelSm" caps color={SypauColor.amber}>
                Needed
              </SypauText>
            ) : null}
          </View>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            {requirement.why}
          </SypauText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${viaSettings ? 'Open settings for' : 'Allow'} ${requirement.title}`}
        disabled={busy}
        onPress={onGrant}
        style={({ pressed }) => [styles.pendingAction, pressed && styles.pressed]}>
        <SypauText variant="labelSm" caps color={SypauColor.boneFaint} style={styles.flex}>
          {viaSettings ? 'In Android settings' : 'Asks right here'}
        </SypauText>
        <SypauText variant="label" caps color={SypauColor.red}>
          {busy ? 'Asking…' : viaSettings ? 'Open settings' : 'Allow'}
        </SypauText>
        <SypauIcon name="chevron" size={16} color={SypauColor.red} />
      </Pressable>
    </DarkCard>
  );
}

export default function PermissionsRoute() {
  return <PermissionsScreen />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: SypauSpace.xs },
  group: { gap: SypauSpace.sm },
  pressed: { opacity: 0.7 },

  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
  },
  segments: { flexDirection: 'row', gap: 4, marginTop: SypauSpace.md },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: SypauColor.hairline,
  },
  segmentDone: { backgroundColor: SypauColor.cyan },
  segmentEssential: { backgroundColor: 'rgba(245,166,35,0.45)' },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginTop: SypauSpace.lg,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.md,
    borderRadius: SypauRadius.button,
    backgroundColor: SypauColor.red,
  },

  pendingRow: { flexDirection: 'row', gap: SypauSpace.md },
  pendingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconEssential: { borderColor: SypauColor.amber },
  pendingTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginBottom: 2,
  },
  pendingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.xs,
    marginTop: SypauSpace.md,
    paddingTop: SypauSpace.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },

  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },
  readyDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },
});
