import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PaperCard } from '@/components/sypau/cards';
import { RedButton, SypauSwitch } from '@/components/sypau/controls';
import { SypauIcon } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { openSettings } from '@/core/nativeBridge';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import type { CapabilityStatus, ControlKey } from '@/types/capability';
import {
  EMPTY_PROFILE_CONFIG,
  PROFILE_ICONS,
  type DndMode,
  type ExitRestoreStrategy,
  type Profile,
  type ProfileConfig,
  type ProfileIcon,
  type RingerMode,
  type ToggleAction,
  type VibrationMode,
} from '@/types/profile';

const NAME_LIMIT = 24;

type ProfileFormProps = {
  existing: Profile | null;
};

/**
 * The profile editor.
 *
 * Every control offers "unchanged" alongside its real values, because applying
 * a profile must only touch what the user deliberately set. Controls Android
 * won't let SYPAU drive still appear — the intention is worth recording — but
 * they carry the reason and a shortcut to the screen that owns them.
 */
export function ProfileForm({ existing }: ProfileFormProps) {
  const createProfile = useProfileStore((s) => s.create);
  const updateProfile = useProfileStore((s) => s.update);
  const capabilities = useEngineStore((s) => s.capabilities);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<ProfileIcon>(existing?.icon ?? 'home');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [config, setConfig] = useState<ProfileConfig>(
    existing?.config ?? { ...EMPTY_PROFILE_CONFIG }
  );
  const [attemptedSave, setAttemptedSave] = useState(false);

  const patch = (next: Partial<ProfileConfig>) => setConfig((current) => ({ ...current, ...next }));

  const nameError = attemptedSave && !name.trim() ? 'Give this profile a name.' : null;

  const save = () => {
    setAttemptedSave(true);
    if (!name.trim()) return;

    if (existing) {
      updateProfile(existing.id, { name: name.trim(), icon, config, isDefault });
      router.back();
      return;
    }

    const profile = createProfile({ name: name.trim(), icon, config, isDefault });
    router.replace({ pathname: '/profiles/[id]', params: { id: profile.id } });
  };

  return (
    <SypauScaffold title={existing ? 'Edit Profile' : 'Create Profile'} showBack>
      <SectionTitle>Profile name</SectionTitle>
      <PaperCard tear="none" contentStyle={styles.inputCard}>
        <TextInput
          value={name}
          onChangeText={(next) => setName(next.slice(0, NAME_LIMIT))}
          placeholder="Study"
          placeholderTextColor="rgba(20,20,18,0.4)"
          style={styles.input}
          maxLength={NAME_LIMIT}
        />
      </PaperCard>
      {nameError ? (
        <SypauText variant="bodySm" color={SypauColor.amber}>
          {nameError}
        </SypauText>
      ) : null}

      <SectionTitle>Icon</SectionTitle>
      <View style={styles.iconGrid}>
        {PROFILE_ICONS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === option }}
            accessibilityLabel={option}
            onPress={() => setIcon(option)}
            style={[styles.iconOption, icon === option && styles.iconOptionSelected]}>
            <SypauIcon
              name={option}
              size={20}
              color={icon === option ? SypauColor.paperInk : SypauColor.boneMuted}
            />
          </Pressable>
        ))}
      </View>

      <SectionTitle>Audio</SectionTitle>

      <ChoiceRow<RingerMode>
        label="Ringer mode"
        controlKey="ringerMode"
        capabilities={capabilities}
        value={config.ringerMode}
        options={[
          { value: 'unchanged', label: 'Leave' },
          { value: 'normal', label: 'Normal' },
          { value: 'vibrate', label: 'Vibrate' },
          { value: 'silent', label: 'Silent' },
        ]}
        onChange={(ringerMode) => patch({ ringerMode })}
      />

      <VolumeRow
        label="Ring volume"
        controlKey="ringVolume"
        capabilities={capabilities}
        value={config.ringVolume}
        onChange={(ringVolume) => patch({ ringVolume })}
      />
      <VolumeRow
        label="Notification volume"
        controlKey="notificationVolume"
        capabilities={capabilities}
        value={config.notificationVolume}
        onChange={(notificationVolume) => patch({ notificationVolume })}
      />
      <VolumeRow
        label="Media volume"
        controlKey="mediaVolume"
        capabilities={capabilities}
        value={config.mediaVolume}
        onChange={(mediaVolume) => patch({ mediaVolume })}
      />
      <VolumeRow
        label="Alarm volume"
        controlKey="alarmVolume"
        capabilities={capabilities}
        value={config.alarmVolume}
        onChange={(alarmVolume) => patch({ alarmVolume })}
        hint="Left alone unless you set it, so silencing your phone never costs you a morning alarm."
      />
      <VolumeRow
        label="System volume"
        controlKey="systemVolume"
        capabilities={capabilities}
        value={config.systemVolume}
        onChange={(systemVolume) => patch({ systemVolume })}
      />

      <SectionTitle>Vibration</SectionTitle>
      <ChoiceRow<VibrationMode>
        label="Vibration"
        controlKey="vibration"
        capabilities={capabilities}
        value={config.vibrationMode}
        options={[
          { value: 'unchanged', label: 'Leave' },
          { value: 'enabled', label: 'On' },
          { value: 'disabled', label: 'Off' },
        ]}
        onChange={(vibrationMode) => patch({ vibrationMode })}
      />

      <SectionTitle>Do Not Disturb</SectionTitle>
      <ChoiceRow<DndMode>
        label="Do Not Disturb"
        controlKey="dnd"
        capabilities={capabilities}
        value={config.dndMode}
        options={[
          { value: 'unchanged', label: 'Leave' },
          { value: 'off', label: 'Off' },
          { value: 'priority', label: 'Priority' },
          { value: 'alarms', label: 'Alarms' },
          { value: 'silence', label: 'Silence' },
        ]}
        onChange={(dndMode) => patch({ dndMode })}
      />

      <SectionTitle>Connectivity</SectionTitle>
      <SypauText variant="bodySm" color={SypauColor.boneFaint}>
        Android reserves these for you. SYPAU records what you want and offers the right settings
        screen — it never reports a change it didn&rsquo;t make.
      </SypauText>

      <ToggleRow
        label="Wi-Fi"
        controlKey="wifi"
        capabilities={capabilities}
        value={config.wifiAction}
        onChange={(wifiAction) => patch({ wifiAction })}
        settingsTarget="wifi"
      />
      <ToggleRow
        label="Bluetooth"
        controlKey="bluetooth"
        capabilities={capabilities}
        value={config.bluetoothAction}
        onChange={(bluetoothAction) => patch({ bluetoothAction })}
        settingsTarget="bluetooth"
      />
      <ToggleRow
        label="Mobile data"
        controlKey="mobileData"
        capabilities={capabilities}
        value={config.mobileDataAction}
        onChange={(mobileDataAction) => patch({ mobileDataAction })}
        settingsTarget="mobileData"
      />
      <ToggleRow
        label="Airplane mode"
        controlKey="airplaneMode"
        capabilities={capabilities}
        value={config.airplaneModeAction}
        onChange={(airplaneModeAction) => patch({ airplaneModeAction })}
        settingsTarget="airplaneMode"
      />

      <SectionTitle>Screen</SectionTitle>
      <ChoiceRow<ProfileConfig['brightnessAction']>
        label="Brightness"
        controlKey="brightness"
        capabilities={capabilities}
        value={config.brightnessAction}
        options={[
          { value: 'unchanged', label: 'Leave' },
          { value: 'auto', label: 'Auto' },
          { value: 'manual', label: 'Manual' },
        ]}
        onChange={(brightnessAction) =>
          patch({
            brightnessAction,
            brightnessValue: brightnessAction === 'manual' ? (config.brightnessValue ?? 50) : null,
          })
        }
      />

      {config.brightnessAction === 'manual' ? (
        <PercentStepper
          label="Brightness level"
          value={config.brightnessValue ?? 50}
          onChange={(brightnessValue) => patch({ brightnessValue })}
        />
      ) : null}

      <VolumeRow
        label="Screen timeout"
        controlKey="screenTimeout"
        capabilities={capabilities}
        value={config.screenTimeoutSeconds}
        onChange={(screenTimeoutSeconds) => patch({ screenTimeoutSeconds })}
        suffix="s"
        step={15}
        max={600}
        min={15}
      />

      <SectionTitle>When this profile ends</SectionTitle>
      <View style={styles.exitOptions}>
        {(
          [
            ['restorePrevious', 'Restore previous', 'Put back exactly what SYPAU changed.'],
            ['defaultProfile', 'Default profile', 'Switch to your default profile.'],
            ['specificProfile', 'Specific profile', 'Switch to a profile you choose on the zone.'],
            ['nothing', 'Do nothing', 'Leave the device as it is.'],
          ] as [ExitRestoreStrategy, string, string][]
        ).map(([value, label, description]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: config.exitRestoreStrategy === value }}
            onPress={() => patch({ exitRestoreStrategy: value })}
            style={[
              styles.exitOption,
              config.exitRestoreStrategy === value && styles.exitOptionSelected,
            ]}>
            <SypauIcon
              name={config.exitRestoreStrategy === value ? 'check' : 'chevron'}
              size={16}
              color={
                config.exitRestoreStrategy === value ? SypauColor.cyan : SypauColor.boneFaint
              }
            />
            <View style={styles.flex}>
              <SypauText variant="label" caps>
                {label}
              </SypauText>
              <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                {description}
              </SypauText>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.defaultRow}>
        <View style={styles.flex}>
          <SypauText variant="label" caps>
            Default profile
          </SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            Used as the fallback when no zone claims your phone.
          </SypauText>
        </View>
        <SypauSwitch value={isDefault} onValueChange={setIsDefault} />
      </View>

      <RedButton label="Save profile" onPress={save} />
    </SypauScaffold>
  );
}

function ControlHeader({
  label,
  controlKey,
  capabilities,
  hint,
  settingsTarget,
}: {
  label: string;
  controlKey: ControlKey;
  capabilities: Record<ControlKey, { status: CapabilityStatus; detail: string }>;
  hint?: string;
  settingsTarget?: Parameters<typeof openSettings>[0];
}) {
  const capability = capabilities[controlKey];
  const blocked = capability && capability.status !== 'availableDirectly';

  return (
    <View style={styles.controlHeader}>
      <View style={styles.flex}>
        <SypauText variant="label" caps>
          {label}
        </SypauText>
        {hint ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            {hint}
          </SypauText>
        ) : null}
        {blocked ? (
          <View style={styles.capabilityRow}>
            <SypauIcon name="alert" size={12} color={SypauColor.amber} />
            <SypauText variant="bodySm" color={SypauColor.amber}>
              {capability.detail}
            </SypauText>
          </View>
        ) : null}
      </View>

      {blocked && settingsTarget ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => openSettings(settingsTarget)}>
          <SypauText variant="labelSm" caps color={SypauColor.red}>
            Open
          </SypauText>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  controlKey,
  capabilities,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  controlKey: ControlKey;
  capabilities: Record<ControlKey, { status: CapabilityStatus; detail: string }>;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  hint?: string;
}) {
  return (
    <View style={styles.control}>
      <ControlHeader
        label={label}
        controlKey={controlKey}
        capabilities={capabilities}
        hint={hint}
      />

      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === option.value }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, value === option.value && styles.chipSelected]}>
            <SypauText
              variant="labelSm"
              caps
              color={value === option.value ? SypauColor.paperInk : SypauColor.boneMuted}>
              {option.label}
            </SypauText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  controlKey,
  capabilities,
  value,
  onChange,
  settingsTarget,
}: {
  label: string;
  controlKey: ControlKey;
  capabilities: Record<ControlKey, { status: CapabilityStatus; detail: string }>;
  value: ToggleAction;
  onChange: (next: ToggleAction) => void;
  settingsTarget: Parameters<typeof openSettings>[0];
}) {
  return (
    <View style={styles.control}>
      <ControlHeader
        label={label}
        controlKey={controlKey}
        capabilities={capabilities}
        settingsTarget={settingsTarget}
      />

      <View style={styles.chips}>
        {(['unchanged', 'on', 'off'] as ToggleAction[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === option }}
            onPress={() => onChange(option)}
            style={[styles.chip, value === option && styles.chipSelected]}>
            <SypauText
              variant="labelSm"
              caps
              color={value === option ? SypauColor.paperInk : SypauColor.boneMuted}>
              {option === 'unchanged' ? 'Leave' : option}
            </SypauText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * A value that can be "unchanged" or a number. Null is the only unchanged
 * marker — zero is a real setting, and conflating the two is how a profile
 * ends up silencing something the user never asked it to.
 */
function VolumeRow({
  label,
  controlKey,
  capabilities,
  value,
  onChange,
  hint,
  suffix = '%',
  step = 10,
  min = 0,
  max = 100,
}: {
  label: string;
  controlKey: ControlKey;
  capabilities: Record<ControlKey, { status: CapabilityStatus; detail: string }>;
  value: number | null;
  onChange: (next: number | null) => void;
  hint?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.control}>
      <ControlHeader
        label={label}
        controlKey={controlKey}
        capabilities={capabilities}
        hint={hint}
      />

      <View style={styles.chips}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
          onPress={() => onChange(null)}
          style={[styles.chip, value === null && styles.chipSelected]}>
          <SypauText
            variant="labelSm"
            caps
            color={value === null ? SypauColor.paperInk : SypauColor.boneMuted}>
            Leave
          </SypauText>
        </Pressable>

        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: value !== null }}
          onPress={() => onChange(value ?? min)}
          style={[styles.chip, value !== null && styles.chipSelected]}>
          <SypauText
            variant="labelSm"
            caps
            color={value !== null ? SypauColor.paperInk : SypauColor.boneMuted}>
            Set
          </SypauText>
        </Pressable>

        {value !== null ? (
          <View style={styles.stepperInline}>
            <StepButton
              icon="minus"
              label={`Lower ${label}`}
              onPress={() => onChange(Math.max(min, value - step))}
            />
            <SypauText variant="label" color={SypauColor.cyan} style={styles.stepperValue}>
              {value}
              {suffix}
            </SypauText>
            <StepButton
              icon="plus"
              label={`Raise ${label}`}
              onPress={() => onChange(Math.min(max, value + step))}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PercentStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.control}>
      <SypauText variant="label" caps>
        {label}
      </SypauText>
      <View style={styles.stepperInline}>
        <StepButton
          icon="minus"
          label={`Lower ${label}`}
          onPress={() => onChange(Math.max(0, value - 10))}
        />
        <SypauText variant="label" color={SypauColor.cyan} style={styles.stepperValue}>
          {value}%
        </SypauText>
        <StepButton
          icon="plus"
          label={`Raise ${label}`}
          onPress={() => onChange(Math.min(100, value + 10))}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <SypauIcon name={icon} size={15} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inputCard: { paddingVertical: SypauSpace.sm },
  input: { color: SypauColor.paperInk, fontSize: 20, paddingVertical: SypauSpace.sm },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SypauSpace.sm },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: { backgroundColor: SypauColor.cyan, borderColor: SypauColor.cyan },

  control: { gap: SypauSpace.sm, paddingVertical: SypauSpace.sm },
  controlHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SypauSpace.md },
  capabilityRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.xs, marginTop: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SypauSpace.sm },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.chip,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
    backgroundColor: SypauColor.surface,
  },
  chipSelected: { backgroundColor: SypauColor.cyan, borderColor: SypauColor.cyan },

  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },
  stepperValue: { minWidth: 52, textAlign: 'center' },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: SypauRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  exitOptions: { gap: SypauSpace.xs },
  exitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    padding: SypauSpace.md,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.surface,
  },
  exitOptionSelected: { borderColor: SypauColor.cyanDim, backgroundColor: SypauColor.surfaceRaised },

  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
  },

  pressed: { opacity: 0.7 },
});
