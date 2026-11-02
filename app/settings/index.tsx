import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { goToTab } from '@/components/sypau/bottomNav';
import { Segmented, SypauSwitch } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { RedCross } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { TornEdge } from '@/components/sypau/tornEdge';
import Svg, { Circle } from 'react-native-svg';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { STATUS_NOTIFICATION_HINTS, STATUS_NOTIFICATION_OPTIONS } from '@/core/statusNotification';
import { listEvents } from '@/db/events';
import { listProfiles } from '@/db/profiles';
import { resetAllData } from '@/db/settings';
import { listZones } from '@/db/zones';
import { useActivityStore } from '@/state/useActivityStore';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import type { TrackingMode } from '@/types/settings';

const TRACKING_OPTIONS: { value: TrackingMode; label: string; sublabel: string }[] = [
  { value: 'batterySaver', label: 'Saver', sublabel: 'Lightest' },
  { value: 'balanced', label: 'Balanced', sublabel: 'Default' },
  { value: 'highAccuracy', label: 'Precise', sublabel: 'Heaviest' },
];

export default function SettingsRoute() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const profiles = useProfileStore((s) => s.profiles);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const permissions = useEngineStore((s) => s.permissions);
  const missingPermissions = Object.values(permissions).filter(
    (permission) => !permission.granted
  ).length;

  const defaultProfile =
    profiles.find((p) => p.id === settings.defaultProfileId) ??
    profiles.find((p) => p.isDefault) ??
    null;

  const exportConfiguration = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: Constants.expoConfig?.version ?? '1.0.0',
      settings,
      profiles: listProfiles(),
      zones: listZones(),
    };

    await writeAndShare('sypauConfiguration.json', JSON.stringify(payload, null, 2), setNotice);
  };

  const exportLogs = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      events: listEvents({ limit: 5000 }),
    };

    await writeAndShare('sypauActivityLog.json', JSON.stringify(payload, null, 2), setNotice);
  };

  return (
    <SypauScaffold showBack showHeader={false}>
      <SettingsHero />

      <SectionTitle>Control</SectionTitle>
      <Group>
        <NavRow
          art="emblem"
          title="Permissions"
          description={
            missingPermissions > 0
              ? `${missingPermissions} ${missingPermissions === 1 ? 'thing needs' : 'things need'} your OK`
              : 'Everything SYPAU needs is granted'
          }
          badge={missingPermissions > 0}
          onPress={() => router.push('/settings/permissions')}
        />
        <NavRow
          icon="pin"
          title="Zones"
          description="Your boundaries, and the map of all of them"
          onPress={() => goToTab('/zones')}
        />
      </Group>

      <SectionTitle>Automation</SectionTitle>
      <Group>
        <ToggleRow
          icon="zap"
          title="SYPAU enabled"
          description="Turn everything off without losing your zones."
          value={settings.automationEnabled}
          onValueChange={(automationEnabled) => update({ automationEnabled })}
        />
        <ToggleRow
          icon="activity"
          title="Background monitoring"
          description="Keep watching zones while the app is closed."
          value={settings.backgroundMonitoringEnabled}
          onValueChange={(backgroundMonitoringEnabled) => update({ backgroundMonitoringEnabled })}
        />
        <ToggleRow
          icon="refresh"
          title="Restore on exit"
          description="Put your phone back the way SYPAU found it."
          value={settings.restorePreviousState}
          onValueChange={(restorePreviousState) => update({ restorePreviousState })}
        />
        <ToggleRow
          icon="clock"
          title="Start on boot"
          description="Resume monitoring after your phone restarts."
          value={settings.startOnBoot}
          onValueChange={(startOnBoot) => update({ startOnBoot })}
        />
      </Group>

      <Group>
        <View style={styles.blockRow}>
          <SypauText variant="bodyMedium">Fallback profile</SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            Used when no zone claims your phone.
          </SypauText>

          <View style={styles.profileChips}>
            {profiles.map((profile) => (
              <Pressable
                key={profile.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: defaultProfile?.id === profile.id }}
                onPress={() => update({ defaultProfileId: profile.id })}
                style={[styles.chip, defaultProfile?.id === profile.id && styles.chipSelected]}>
                <SypauText
                  variant="labelSm"
                  caps
                  color={
                    defaultProfile?.id === profile.id ? SypauColor.paperInk : SypauColor.boneMuted
                  }>
                  {profile.name}
                </SypauText>
              </Pressable>
            ))}
          </View>
        </View>
      </Group>

      <SectionTitle>Location</SectionTitle>
      <Group>
        <View style={styles.blockRow}>
          <SypauText variant="bodyMedium">Tracking mode</SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            Balanced leans on Android&rsquo;s own geofencing, which costs almost nothing. Precise
            adds a constant location service and noticeably more battery.
          </SypauText>

          <Segmented
            options={TRACKING_OPTIONS}
            value={settings.trackingMode}
            onChange={(trackingMode) => update({ trackingMode })}
            style={styles.trackingSegmented}
          />
        </View>
      </Group>

      <SectionTitle>Notifications</SectionTitle>
      <Group>
        <View style={styles.blockRow}>
          <SypauText variant="bodyMedium">Status in the notification bar</SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            A quiet, pinned line saying which profile holds your phone. No sound, no banner.
          </SypauText>

          <Segmented
            options={STATUS_NOTIFICATION_OPTIONS}
            value={settings.statusNotification}
            onChange={(statusNotification) => update({ statusNotification })}
            style={styles.trackingSegmented}
          />
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            {STATUS_NOTIFICATION_HINTS[settings.statusNotification]}
          </SypauText>
        </View>
      </Group>

      <Group>
        <ToggleRow
          icon="bell"
          badge
          title="Profile changes"
          description="Tell me when a profile takes over."
          value={settings.notifyOnProfileChange}
          onValueChange={(notifyOnProfileChange) => update({ notifyOnProfileChange })}
        />
        <ToggleRow
          icon="pin"
          title="Zone transitions"
          description="Tell me when I enter or leave a zone."
          value={settings.notifyOnZoneTransition}
          onValueChange={(notifyOnZoneTransition) => update({ notifyOnZoneTransition })}
        />
        <ToggleRow
          icon="alert"
          title="Errors"
          description="Tell me when something couldn't be applied."
          value={settings.notifyOnError}
          onValueChange={(notifyOnError) => update({ notifyOnError })}
        />
      </Group>

      <SectionTitle>Data</SectionTitle>
      <Group>
        <NavRow
          icon="export"
          title="Export configuration"
          description="Back up your zones, profiles and settings"
          onPress={exportConfiguration}
        />
        <NavRow
          icon="export"
          title="Export activity log"
          description="Save the full event history"
          onPress={exportLogs}
        />
        <NavRow
          icon="trash"
          title="Clear activity log"
          description="Keep zones and profiles, drop the history"
          onPress={() => setConfirmClearLogs(true)}
        />
        <NavRow
          icon="alert"
          title="Reset app data"
          description="Delete everything and start over"
          destructive
          onPress={() => setConfirmReset(true)}
        />
      </Group>

      <SectionTitle>Preferences</SectionTitle>
      <Group>
        <NavRow
          icon="shield"
          iconColor={SypauColor.red}
          title="Privacy"
          description="Your location never leaves this phone"
          onPress={() => setPrivacyOpen(true)}
        />
        <ToggleRow
          icon="layers"
          title="Textures"
          description="The paper and grain overlays."
          value={settings.texturesEnabled}
          onValueChange={(texturesEnabled) => update({ texturesEnabled })}
        />
        <ToggleRow
          icon="activity"
          title="Reduced motion"
          description="Stop the radar and pulse animations."
          value={settings.reducedMotion}
          onValueChange={(reducedMotion) => update({ reducedMotion })}
        />
        <ToggleRow
          icon="target"
          title="GPS debug"
          description="Show GPS accuracy and logs."
          value={settings.debugEnabled}
          tone="red"
          onValueChange={(debugEnabled) => update({ debugEnabled })}
        />
        {settings.debugEnabled ? (
          <NavRow
            icon="bug"
            title="Open GPS debug"
            description="Live location and geofence diagnostics"
            onPress={() => router.push('/debug')}
          />
        ) : null}
      </Group>

      <SectionTitle>About</SectionTitle>
      <Group>
        <NavRow
          art="emblem"
          title="About SYPAU"
          description={`Version ${Constants.expoConfig?.version ?? '1.0.0'} \u2022 You set the silence`}
          onPress={() => setAboutOpen(true)}
        />
      </Group>

      <SypauConfirmDialog
        visible={privacyOpen}
        icon="shield"
        title="Privacy"
        message="Your location is processed on this phone and never leaves it. Zones, profiles and the activity log are stored only in this app. SYPAU has no account, no server and no analytics."
        confirmLabel="Got it"
        cancelLabel={null}
        onCancel={() => setPrivacyOpen(false)}
        onConfirm={() => setPrivacyOpen(false)}
      />

      <SypauConfirmDialog
        visible={aboutOpen}
        icon="info"
        title="SYPAU"
        message={`Version ${Constants.expoConfig?.version ?? '1.0.0'}. Draw zones on a map, attach a profile to each, and your phone changes how it behaves the moment you cross the line.`}
        confirmLabel="Close"
        cancelLabel={null}
        onCancel={() => setAboutOpen(false)}
        onConfirm={() => setAboutOpen(false)}
      />

      <SypauConfirmDialog
        visible={confirmClearLogs}
        destructive
        title="Clear activity log?"
        message="Every logged event goes. Your zones and profiles stay."
        confirmLabel="Clear log"
        onCancel={() => setConfirmClearLogs(false)}
        onConfirm={() => {
          useActivityStore.getState().clear();
          setConfirmClearLogs(false);
        }}
      />

      <SypauConfirmDialog
        visible={confirmReset}
        destructive
        title="Reset everything?"
        message="Your zones, profiles, settings and history are all deleted. This can't be undone."
        confirmLabel="Delete it all"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAllData();
          setConfirmReset(false);
          router.replace('/');
        }}
      />

      <SypauConfirmDialog
        visible={notice !== null}
        title="Export"
        message={notice ?? ''}
        icon="info"
        confirmLabel="Got it"
        cancelLabel={null}
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
      />
    </SypauScaffold>
  );
}

async function writeAndShare(
  filename: string,
  contents: string,
  onNotice: (message: string) => void
): Promise<void> {
  try {
    const directory = FileSystem.Paths.cache.uri;
    const file = new FileSystem.File(directory, filename);
    file.write(contents);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      return;
    }

    onNotice(`Saved to ${file.uri}. Sharing isn’t available on this device.`);
  } catch (error) {
    onNotice(error instanceof Error ? error.message : 'Couldn’t write the export file.');
  }
}

/**
 * The settings reference's top: the poster wordmark over faint radar rings,
 * the red cross between two rules, and the spaced-out title, torn off below.
 */
function SettingsHero() {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.hero} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.rings} pointerEvents="none">
        <Svg width={360} height={360} viewBox="0 0 360 360">
          {[170, 130, 90].map((r) => (
            <Circle key={r} cx={180} cy={180} r={r} stroke={SypauColor.hairline} strokeWidth={1} fill="none" />
          ))}
        </Svg>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => router.back()}
        style={styles.heroBack}>
        <SypauIcon name="back" size={26} />
      </Pressable>
      <SypauText variant="display" style={styles.heroWord}>
        SYPAU
      </SypauText>
      <View style={styles.heroDivider}>
        <View style={styles.heroRule} />
        <RedCross size={30} />
        <View style={styles.heroRule} />
      </View>
      <SypauText variant="section" caps color={SypauColor.bone} style={styles.heroCaption}>
        Settings
      </SypauText>
      <View style={styles.heroTear}>
        <TornEdge width={width + SypauSpace.gutter * 2} color={SypauColor.ink} facing="down" seed={41} height={10} />
      </View>
    </View>
  );
}

/** One card per section, rows divided by hairlines, as in the reference. */
function Group({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      <Grain opacity={0.1} />
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.groupDivider : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

function RowArt({
  icon,
  art,
  color,
  badge,
}: {
  icon?: SypauIconName;
  art?: 'emblem';
  color: string;
  badge?: boolean;
}) {
  return (
    <View style={styles.rowArt}>
      {art === 'emblem' ? (
        <Image source={SypauAsset.emblem} style={styles.rowEmblem} contentFit="contain" />
      ) : icon ? (
        <SypauIcon name={icon} size={24} color={color} />
      ) : null}
      {badge ? <View style={styles.rowBadge} /> : null}
    </View>
  );
}

function NavRow({
  icon,
  art,
  iconColor,
  title,
  description,
  onPress,
  badge = false,
  destructive = false,
}: {
  icon?: SypauIconName;
  art?: 'emblem';
  iconColor?: string;
  title: string;
  description: string;
  onPress: () => void;
  badge?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <RowArt
        icon={icon}
        art={art}
        badge={badge}
        color={destructive ? SypauColor.red : (iconColor ?? SypauColor.boneMuted)}
      />
      <View style={styles.rowText}>
        <SypauText variant="bodyMedium" style={styles.rowTitle} color={destructive ? SypauColor.red : SypauColor.bone}>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {description}
        </SypauText>
      </View>
      <SypauIcon name="chevron" size={20} color={SypauColor.boneFaint} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  badge = false,
  tone = 'cyan',
}: {
  icon: SypauIconName;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  badge?: boolean;
  tone?: 'cyan' | 'red';
}) {
  return (
    <View style={styles.row}>
      <RowArt icon={icon} badge={badge} color={SypauColor.boneMuted} />
      <View style={styles.rowText}>
        <SypauText variant="bodyMedium" style={styles.rowTitle}>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {description}
        </SypauText>
      </View>
      <SypauSwitch value={value} onValueChange={onValueChange} tone={tone} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: SypauSpace.xxl * 2, paddingBottom: SypauSpace.xl, marginHorizontal: -SypauSpace.gutter, backgroundColor: SypauColor.surfaceRaised, overflow: 'hidden' },
  rings: { position: 'absolute', top: -60, alignSelf: 'center' },
  heroBack: { position: 'absolute', top: SypauSpace.lg, left: SypauSpace.gutter },
  heroWord: { fontSize: 76, lineHeight: 82 },
  heroDivider: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md, marginTop: -SypauSpace.xs },
  heroRule: { width: 70, height: 1.5, backgroundColor: SypauColor.bone, opacity: 0.8 },
  heroCaption: { fontSize: 18, letterSpacing: 10, marginTop: SypauSpace.sm, marginLeft: 10 },
  heroTear: { position: 'absolute', bottom: -1, left: 0, right: 0 },

  group: {
    backgroundColor: SypauColor.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.card,
    overflow: 'hidden',
  },
  groupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SypauColor.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.lg,
    paddingHorizontal: SypauSpace.lg,
  },
  rowArt: { width: 40, alignItems: 'center' },
  rowEmblem: { width: 40, height: 36 },
  rowBadge: {
    position: 'absolute',
    top: -2,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: SypauColor.red,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17 },
  blockRow: { padding: SypauSpace.lg, gap: SypauSpace.xs },

  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SypauSpace.sm,
    marginTop: SypauSpace.md,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.chip,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },
  chipSelected: { backgroundColor: SypauColor.cyan, borderColor: SypauColor.cyan },

  trackingSegmented: { marginTop: SypauSpace.md },

  pressed: { opacity: 0.75 },
});
