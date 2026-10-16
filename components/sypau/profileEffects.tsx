import { StyleSheet, View } from 'react-native';

import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { SypauColor, SypauSpace } from '@/constants/sypau';
import { controlLabel } from '@/core/zoneEngine';
import type { CapabilityMap, ControlKey } from '@/types/capability';
import type { ProfileConfig } from '@/types/profile';

type Effect = {
  key: ControlKey;
  icon: SypauIconName;
  value: string;
};

/**
 * The controls a profile actually sets, with what it sets them to.
 *
 * Only configured controls appear: a list padded out with "unchanged" rows
 * would bury the handful of things the profile really does.
 */
export function effectsOf(config: ProfileConfig): Effect[] {
  const effects: Effect[] = [];

  if (config.dndMode !== 'unchanged') {
    effects.push({ key: 'dnd', icon: 'dnd', value: dndLabel(config.dndMode) });
  }
  if (config.ringerMode !== 'unchanged') {
    effects.push({ key: 'ringerMode', icon: 'phone', value: titleCase(config.ringerMode) });
  }
  if (config.ringVolume !== null) {
    effects.push({ key: 'ringVolume', icon: 'volume', value: `${config.ringVolume}%` });
  }
  if (config.notificationVolume !== null) {
    effects.push({
      key: 'notificationVolume',
      icon: 'message',
      value: `${config.notificationVolume}%`,
    });
  }
  if (config.mediaVolume !== null) {
    effects.push({ key: 'mediaVolume', icon: 'volume', value: `${config.mediaVolume}%` });
  }
  if (config.alarmVolume !== null) {
    effects.push({ key: 'alarmVolume', icon: 'bell', value: `${config.alarmVolume}%` });
  }
  if (config.systemVolume !== null) {
    effects.push({ key: 'systemVolume', icon: 'volume', value: `${config.systemVolume}%` });
  }
  if (config.vibrationMode !== 'unchanged') {
    effects.push({
      key: 'vibration',
      icon: 'vibrate',
      value: config.vibrationMode === 'enabled' ? 'On' : 'Off',
    });
  }
  if (config.wifiAction !== 'unchanged') {
    effects.push({ key: 'wifi', icon: 'wifi', value: titleCase(config.wifiAction) });
  }
  if (config.bluetoothAction !== 'unchanged') {
    effects.push({ key: 'bluetooth', icon: 'bluetooth', value: titleCase(config.bluetoothAction) });
  }
  if (config.mobileDataAction !== 'unchanged') {
    effects.push({ key: 'mobileData', icon: 'signal', value: titleCase(config.mobileDataAction) });
  }
  if (config.airplaneModeAction !== 'unchanged') {
    effects.push({
      key: 'airplaneMode',
      icon: 'airplane',
      value: titleCase(config.airplaneModeAction),
    });
  }
  if (config.brightnessAction !== 'unchanged') {
    effects.push({
      key: 'brightness',
      icon: 'sun',
      value:
        config.brightnessAction === 'auto'
          ? 'Auto'
          : config.brightnessValue !== null
            ? `${config.brightnessValue}%`
            : 'Manual',
    });
  }
  if (config.screenTimeoutSeconds !== null) {
    effects.push({
      key: 'screenTimeout',
      icon: 'clock',
      value: `${config.screenTimeoutSeconds}s`,
    });
  }

  return effects;
}

/**
 * The zone-detail form of the list: what happens when the zone takes over, in
 * the order it's applied, as the reference's numbered ACTIONS (IN ORDER).
 * A blocked control trades its icon for a warning instead of repeating the
 * same sentence under every row — the caller explains it once.
 */
export function NumberedEffectRows({
  config,
  capabilities,
}: {
  config: ProfileConfig;
  capabilities: CapabilityMap;
}) {
  const effects = effectsOf(config);

  if (effects.length === 0) {
    return (
      <SypauText variant="bodySm" color={SypauColor.boneFaint}>
        This profile doesn&rsquo;t change anything yet.
      </SypauText>
    );
  }

  return (
    <View>
      {effects.map((effect, index) => {
        const note = capabilityNote(capabilities[effect.key]?.status);
        return (
          <View
            key={effect.key}
            style={[styles.numberedRow, index > 0 && styles.numberedDivider]}
            accessible
            accessibilityLabel={`${index + 1}. ${controlLabel(effect.key)}: ${effect.value}${note ? `. ${note.text}` : ''}`}>
            <View style={styles.step}>
              <SypauText variant="labelSm" color={SypauColor.red}>
                {index + 1}
              </SypauText>
            </View>
            <View style={styles.labels}>
              <SypauText variant="label" caps>
                {controlLabel(effect.key)}
              </SypauText>
              <SypauText variant="bodySm" color={note ? note.color : SypauColor.boneMuted}>
                {note ? `${effect.value} · ${note.text}` : `Set to ${effect.value.toLowerCase()}`}
              </SypauText>
            </View>
            <SypauIcon
              name={note ? 'alert' : effect.icon}
              size={20}
              color={note ? note.color : SypauColor.bone}
            />
          </View>
        );
      })}
    </View>
  );
}

/** How many of a profile's controls Android is currently blocking. */
export function blockedEffectCount(config: ProfileConfig, capabilities: CapabilityMap): number {
  return effectsOf(config).filter((effect) => {
    const status = capabilities[effect.key]?.status;
    return status === 'requiresPermission' || status === 'requiresSettingsPanel';
  }).length;
}

type ProfileEffectRowsProps = {
  config: ProfileConfig;
  capabilities: CapabilityMap;
  /** Hides the per-control status notes on compact surfaces. */
  compact?: boolean;
};

/**
 * Each row says what the profile sets, and — where Android won't let SYPAU do
 * it directly — what stands in the way. The status is never omitted just
 * because it's inconvenient.
 */
export function ProfileEffectRows({ config, capabilities, compact = false }: ProfileEffectRowsProps) {
  const effects = effectsOf(config);

  if (effects.length === 0) {
    return (
      <SypauText variant="bodySm" color={SypauColor.boneFaint}>
        This profile doesn&rsquo;t change anything yet.
      </SypauText>
    );
  }

  return (
    <View style={styles.list}>
      {effects.map((effect) => {
        const capability = capabilities[effect.key];
        const note = capabilityNote(capability?.status);

        return (
          <View key={effect.key} style={styles.row}>
            <SypauIcon name={effect.icon} size={15} color={SypauColor.boneMuted} />

            <View style={styles.labels}>
              <SypauText variant="labelSm" caps color={SypauColor.bone}>
                {controlLabel(effect.key)}
              </SypauText>
              {!compact && note ? (
                <SypauText variant="bodySm" color={note.color}>
                  {note.text}
                </SypauText>
              ) : null}
            </View>

            <SypauText variant="label" caps color={SypauColor.cyan}>
              {effect.value}
            </SypauText>
          </View>
        );
      })}
    </View>
  );
}

function capabilityNote(
  status: CapabilityMap[ControlKey]['status'] | undefined
): { text: string; color: string } | null {
  switch (status) {
    case 'requiresPermission':
      return { text: 'Permission required', color: SypauColor.amber };
    case 'requiresSettingsPanel':
      return { text: 'Manual action required', color: SypauColor.amber };
    case 'unsupported':
      return { text: 'Unavailable on this device', color: SypauColor.boneFaint };
    default:
      return null;
  }
}

function dndLabel(mode: ProfileConfig['dndMode']): string {
  switch (mode) {
    case 'off':
      return 'Off';
    case 'priority':
      return 'Priority';
    case 'alarms':
      return 'Alarms only';
    case 'silence':
      return 'Total silence';
    default:
      return 'Unchanged';
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  list: { gap: SypauSpace.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md },
  labels: { flex: 1 },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.sm + 2,
  },
  numberedDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },
  step: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: SypauColor.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
