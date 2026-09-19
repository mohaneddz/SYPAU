import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { Segmented, SypauSwitch } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { listEvents } from '@/db/events';
import { listProfiles } from '@/db/profiles';
import { resetAllData } from '@/db/settings';
import { listZones } from '@/db/zones';
import { useActivityStore } from '@/state/useActivityStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import type { TrackingMode } from '@/types/settings';

const TRACKING_OPTIONS: { value: TrackingMode; label: string; sublabel: string }[] = [
  { value: 'batterySaver', label: 'Saver', sublabel: 'Lightest' },
  { value: 'balanced', label: 'Balanced', sublabel: 'Recommended' },
  { value: 'highAccuracy', label: 'Precise', sublabel: 'Heaviest' },
];

export default function SettingsRoute() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const profiles = useProfileStore((s) => s.profiles);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    <SypauScaffold wordmark showBack>
      <SypauText variant="section" caps align="center" color={SypauColor.boneMuted}>
        Settings
      </SypauText>

      <SectionTitle>Control</SectionTitle>

      <NavRow
        icon="lock"
        title="Permissions"
        description="Location, notifications and system access"
        onPress={() => router.push('/settings/permissions')}
      />
      <NavRow
        icon="layers"
        title="Profiles"
        description="Manage how your phone behaves"
        onPress={() => router.push('/profiles')}
      />
      <NavRow
        icon="pin"
        title="Zones"
        description="Manage your boundaries"
        onPress={() => router.push('/zones')}
      />

      <SectionTitle>Automation</SectionTitle>

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
        description="Put your device back the way SYPAU found it."
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

      <DarkCard>
        <SypauText variant="label" caps>
          Fallback profile
        </SypauText>
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
              style={[
                styles.chip,
                defaultProfile?.id === profile.id && styles.chipSelected,
              ]}>
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
      </DarkCard>

      <SectionTitle>Location</SectionTitle>

      <DarkCard>
        <SypauText variant="label" caps>
          Tracking mode
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          Balanced leans on Android&rsquo;s own geofencing, which costs almost nothing. Precise adds
          a constant location service and noticeably more battery.
        </SypauText>

        <Segmented
          options={TRACKING_OPTIONS}
          value={settings.trackingMode}
          onChange={(trackingMode) => update({ trackingMode })}
          style={styles.trackingSegmented}
        />
      </DarkCard>

      <SectionTitle>Notifications</SectionTitle>

      <ToggleRow
        icon="layers"
        title="Profile changes"
        description="Log when a profile activates."
        value={settings.notifyOnProfileChange}
        onValueChange={(notifyOnProfileChange) => update({ notifyOnProfileChange })}
      />
      <ToggleRow
        icon="pin"
        title="Zone transitions"
        description="Log entering and leaving a zone."
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

      <SectionTitle>Data &amp; storage</SectionTitle>

      <NavRow
        icon="export"
        title="Export configuration"
        description="Save your zones, profiles and settings"
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

      <SectionTitle>Privacy</SectionTitle>
      <DarkCard>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          Your location is processed on this device and never leaves it. Zones, profiles and the
          activity log are stored locally in this app. SYPAU has no account, no server and no
          analytics.
        </SypauText>
      </DarkCard>

      <SectionTitle>Appearance</SectionTitle>

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

      <SectionTitle>Developer</SectionTitle>

      <ToggleRow
        icon="bug"
        title="GPS debug"
        description="Show the location diagnostic screen."
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

      <SectionTitle>About</SectionTitle>
      <DarkCard>
        <View style={styles.aboutRow}>
          <SypauText variant="label" caps>
            SYPAU
          </SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            Version {Constants.expoConfig?.version ?? '1.0.0'}
          </SypauText>
        </View>
        <SypauText variant="bodySm" color={SypauColor.boneFaint}>
          You set the silence. We keep it that way.
        </SypauText>
      </DarkCard>

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
        confirmLabel="Got it"
        cancelLabel="Close"
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

function NavRow({
  icon,
  title,
  description,
  onPress,
  destructive = false,
}: {
  icon: SypauIconName;
  title: string;
  description: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <SypauIcon
        name={icon}
        size={20}
        color={destructive ? SypauColor.red : SypauColor.boneMuted}
      />
      <View style={styles.rowText}>
        <SypauText variant="label" caps color={destructive ? SypauColor.red : SypauColor.bone}>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {description}
        </SypauText>
      </View>
      <SypauIcon name="chevron" size={18} color={SypauColor.boneFaint} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  tone = 'cyan',
}: {
  icon: SypauIconName;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  tone?: 'cyan' | 'red';
}) {
  return (
    <View style={styles.row}>
      <SypauIcon name={icon} size={20} color={SypauColor.boneMuted} />
      <View style={styles.rowText}>
        <SypauText variant="label" caps>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {description}
        </SypauText>
      </View>
      <SypauSwitch
        value={value}
        onValueChange={onValueChange}
        tone={tone}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.md,
    backgroundColor: SypauColor.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.chip,
  },
  rowText: { flex: 1, gap: 2 },

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

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SypauSpace.xs,
  },

  pressed: { opacity: 0.75 },
});
