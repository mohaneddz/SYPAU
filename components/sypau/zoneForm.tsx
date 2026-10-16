import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BoundaryEditor,
  draftToGeometry,
  geometryToDraft,
  type BoundaryDraft,
} from '@/components/sypau/boundaryEditor';
import { PaperCard } from '@/components/sypau/cards';
import { RedButton, Segmented, SypauSwitch } from '@/components/sypau/controls';
import { HandUnderline, SypauHeader } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauColor, SypauFont, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import type { BoundaryType, ExitBehavior, Zone } from '@/types/zone';

const NAME_LIMIT = 24;

const BOUNDARY_OPTIONS: { value: BoundaryType; label: string }[] = [
  { value: 'polygon', label: 'Polygon' },
  { value: 'radius', label: 'Radius' },
  { value: 'freehand', label: 'Freehand' },
];

const EXIT_OPTIONS: { value: ExitBehavior; label: string; description: string }[] = [
  {
    value: 'restorePrevious',
    label: 'Restore previous',
    description: 'Put back exactly what SYPAU changed.',
  },
  { value: 'defaultProfile', label: 'Default profile', description: 'Switch to your default.' },
  { value: 'specificProfile', label: 'Specific profile', description: 'Switch to a chosen profile.' },
  { value: 'nothing', label: 'Do nothing', description: 'Leave the device as it is.' },
];

type ZoneFormProps = {
  /** Null when creating. */
  existing: Zone | null;
};

/**
 * Create and edit share this form: the same map, fields and validation, so the
 * two screens can't drift apart.
 */
export function ZoneForm({ existing }: ZoneFormProps) {
  const insets = useSafeAreaInsets();
  const profiles = useProfileStore((s) => s.profiles);
  const createZone = useZoneStore((s) => s.create);
  const updateZone = useZoneStore((s) => s.update);
  const fix = useEngineStore((s) => s.fix);

  const defaultProfileId = profiles.find((p) => p.isDefault)?.id ?? profiles[0]?.id ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [boundaryType, setBoundaryType] = useState<BoundaryType>(
    existing?.boundaryType ?? 'polygon'
  );
  const [draft, setDraft] = useState<BoundaryDraft>(() =>
    existing
      ? geometryToDraft(existing.geometry, existing.boundaryType)
      : { type: 'polygon', points: [] }
  );
  const [profileId, setProfileId] = useState<string | null>(
    existing?.profileId ?? defaultProfileId
  );
  const [exitBehavior, setExitBehavior] = useState<ExitBehavior>(
    existing?.exitBehavior ?? 'restorePrevious'
  );
  const [exitProfileId, setExitProfileId] = useState<string | null>(
    existing?.exitProfileId ?? null
  );
  const [priority, setPriority] = useState(existing?.priority ?? 10);
  const [activationDelay, setActivationDelay] = useState(existing?.activationDelaySeconds ?? 0);
  const [exitDelay, setExitDelay] = useState(existing?.exitDelaySeconds ?? 0);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [attemptedSave, setAttemptedSave] = useState(false);

  const geometry = draftToGeometry(draft);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Give this zone a name.');
    if (!geometry) {
      list.push(
        draft.type === 'radius'
          ? 'Tap the map to place the centre.'
          : 'Place at least three points on the map.'
      );
    }
    if (!profileId) list.push('Choose a profile for this zone.');
    if (exitBehavior === 'specificProfile' && !exitProfileId) {
      list.push('Choose which profile to switch to on exit.');
    }
    return list;
  }, [name, geometry, profileId, exitBehavior, exitProfileId, draft.type]);

  const changeBoundaryType = (next: BoundaryType) => {
    setBoundaryType(next);

    // A radius and a polygon can't describe each other, so switching starts a
    // fresh draft rather than silently mangling what was drawn. The centre is
    // kept where it can be, so the user doesn't lose their place on the map.
    if (next === 'radius') {
      const center =
        draft.type === 'radius'
          ? draft.center
          : (draft.points[0] ?? fix?.point ?? null);
      setDraft({ type: 'radius', center, radiusMeters: 150 });
      return;
    }

    const points = draft.type === 'radius' ? [] : draft.points;
    setDraft(next === 'freehand' ? { type: 'freehand', points } : { type: 'polygon', points });
  };

  const save = () => {
    setAttemptedSave(true);
    if (errors.length > 0 || !geometry || !profileId) return;

    const input = {
      name: name.trim(),
      icon: existing?.icon ?? ('pin' as const),
      boundaryType,
      geometry,
      profileId,
      exitBehavior,
      exitProfileId: exitBehavior === 'specificProfile' ? exitProfileId : null,
      priority,
      activationDelaySeconds: activationDelay,
      exitDelaySeconds: exitDelay,
      enabled,
    };

    if (existing) {
      updateZone(existing.id, input);
      router.back();
      return;
    }

    const zone = createZone(input);
    router.replace({ pathname: '/zones/[id]', params: { id: zone.id } });
  };

  return (
    <View style={styles.page}>
      <View style={{ paddingTop: insets.top }}>
        <SypauHeader title={existing ? 'Edit Zone' : 'Create Zone'} showBack />
      </View>

      <View style={styles.tagline}>
        <SypauText variant="hand" color={SypauColor.bone}>
          Draw your boundary.
        </SypauText>
        <HandUnderline width={90} />
      </View>

      <BoundaryEditor
        draft={draft}
        onChange={setDraft}
        userLocation={fix?.point ?? null}
        style={styles.editor}
      />

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}>
        <Grain opacity={0.12} />

        <SectionTitle>Zone name</SectionTitle>
        <PaperCard tear="none" contentStyle={styles.inputCard}>
          <TextInput
            value={name}
            onChangeText={(next) => setName(next.slice(0, NAME_LIMIT))}
            placeholder="Peace Block"
            placeholderTextColor="rgba(20,20,18,0.4)"
            style={styles.input}
            maxLength={NAME_LIMIT}
          />
          {name.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear zone name"
              hitSlop={12}
              onPress={() => setName('')}>
              <SypauIcon name="close" size={22} color={SypauColor.paperInk} />
            </Pressable>
          ) : null}
        </PaperCard>
        <SypauText variant="bodySm" color={SypauColor.boneFaint} align="right">
          {name.length}/{NAME_LIMIT}
        </SypauText>

        <SectionTitle>Boundary type</SectionTitle>
        <Segmented
          options={BOUNDARY_OPTIONS}
          value={boundaryType}
          onChange={changeBoundaryType}
        />

        {draft.type === 'radius' ? (
          <RadiusStepper
            value={draft.radiusMeters}
            onChange={(radiusMeters) => setDraft({ ...draft, radiusMeters })}
          />
        ) : null}

        <SectionTitle>When inside</SectionTitle>
        <ProfilePicker
          profiles={profiles}
          value={profileId}
          onChange={setProfileId}
          emptyLabel="Choose a profile"
        />

        <SectionTitle>When outside</SectionTitle>
        <View style={styles.exitOptions}>
          {EXIT_OPTIONS.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              description={option.description}
              selected={exitBehavior === option.value}
              onPress={() => setExitBehavior(option.value)}
            />
          ))}
        </View>

        {exitBehavior === 'specificProfile' ? (
          <ProfilePicker
            profiles={profiles}
            value={exitProfileId}
            onChange={setExitProfileId}
            emptyLabel="Choose the exit profile"
          />
        ) : null}

        <SectionTitle>Timing</SectionTitle>
        <Stepper
          label="Activate after"
          value={activationDelay}
          suffix="s"
          step={10}
          max={300}
          onChange={setActivationDelay}
          hint="Stops a drive-past from tripping the zone."
        />
        <Stepper
          label="Release after"
          value={exitDelay}
          suffix="s"
          step={10}
          max={300}
          onChange={setExitDelay}
          hint="Keeps the profile on through a brief step outside."
        />
        <Stepper
          label="Priority"
          value={priority}
          step={5}
          max={100}
          onChange={setPriority}
          hint="Higher wins when zones overlap."
        />

        <View style={styles.enabledRow}>
          <View style={styles.enabledText}>
            <SypauText variant="label" caps>
              Zone enabled
            </SypauText>
            <SypauText variant="bodySm" color={SypauColor.boneMuted}>
              A paused zone is kept but never activates.
            </SypauText>
          </View>
          <SypauSwitch value={enabled} onValueChange={setEnabled} />
        </View>

        {attemptedSave && errors.length > 0 ? (
          <View style={styles.errors}>
            {errors.map((error) => (
              <View key={error} style={styles.errorRow}>
                <SypauIcon name="alert" size={14} color={SypauColor.amber} />
                <SypauText variant="bodySm" color={SypauColor.amber}>
                  {error}
                </SypauText>
              </View>
            ))}
          </View>
        ) : null}

        <RedButton
          label={existing ? 'Save zone' : 'Activate silence'}
          onPress={save}
          style={styles.save}
        />
      </ScrollView>
    </View>
  );
}

function RadiusStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <Stepper
      label="Radius"
      value={value}
      suffix="m"
      step={25}
      min={50}
      max={5000}
      onChange={onChange}
      hint="Android needs at least 50 m to watch a zone reliably."
    />
  );
}

function Stepper({
  label,
  value,
  onChange,
  suffix = '',
  step = 1,
  min = 0,
  max = 100,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperText}>
        <SypauText variant="label" caps>
          {label}
        </SypauText>
        {hint ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            {hint}
          </SypauText>
        ) : null}
      </View>

      <View style={styles.stepperControls}>
        <StepButton
          icon="minus"
          label={`Decrease ${label}`}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <SypauText variant="cardTitle" color={SypauColor.cyan} style={styles.stepperValue}>
          {value}
          {suffix}
        </SypauText>
        <StepButton
          icon="plus"
          label={`Increase ${label}`}
          onPress={() => onChange(Math.min(max, value + step))}
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
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}>
      <SypauIcon name={icon} size={16} />
    </Pressable>
  );
}

function ProfilePicker({
  profiles,
  value,
  onChange,
  emptyLabel,
}: {
  profiles: import('@/types/profile').Profile[];
  value: string | null;
  onChange: (next: string) => void;
  emptyLabel: string;
}) {
  if (profiles.length === 0) {
    return (
      <SypauText variant="bodySm" color={SypauColor.amber}>
        No profiles yet — create one first.
      </SypauText>
    );
  }

  return (
    <View style={styles.profileList}>
      {!value ? (
        <SypauText variant="bodySm" color={SypauColor.boneFaint}>
          {emptyLabel}
        </SypauText>
      ) : null}

      {profiles.map((profile) => (
        <OptionRow
          key={profile.id}
          label={profile.name}
          description={profile.isDefault ? 'Default profile' : undefined}
          icon={profile.icon}
          selected={value === profile.id}
          onPress={() => onChange(profile.id)}
        />
      ))}
    </View>
  );
}

function OptionRow({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  icon?: import('@/components/sypau/icon').SypauIconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowSelected,
        pressed && styles.optionRowPressed,
      ]}>
      <SypauIcon
        name={selected ? 'check' : (icon ?? 'chevron')}
        size={18}
        color={selected ? SypauColor.cyan : SypauColor.boneFaint}
      />
      <View style={styles.optionText}>
        <SypauText variant="label" caps color={selected ? SypauColor.bone : SypauColor.boneMuted}>
          {label}
        </SypauText>
        {description ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            {description}
          </SypauText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: SypauColor.ink },
  tagline: { alignItems: 'center', paddingBottom: SypauSpace.sm },
  editor: { height: '42%' },
  sheet: { flex: 1, backgroundColor: SypauColor.ink },
  sheetContent: { padding: SypauSpace.gutter, gap: SypauSpace.md },

  inputCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: SypauSpace.sm },
  input: {
    flex: 1,
    color: SypauColor.paperInk,
    // The reference writes the name by hand on the paper strip.
    fontFamily: SypauFont.hand,
    fontSize: 26,
    paddingVertical: SypauSpace.xs,
  },

  exitOptions: { gap: SypauSpace.xs },
  profileList: { gap: SypauSpace.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.md,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.surface,
  },
  optionRowSelected: { borderColor: SypauColor.cyanDim, backgroundColor: SypauColor.surfaceRaised },
  optionRowPressed: { opacity: 0.8 },
  optionText: { flex: 1 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.sm,
  },
  stepperText: { flex: 1, gap: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },
  stepperValue: { minWidth: 62, textAlign: 'center' },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: SypauRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPressed: { backgroundColor: SypauColor.surfaceRaised },

  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
  },
  enabledText: { flex: 1, gap: 2 },

  errors: { gap: SypauSpace.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },

  save: { marginTop: SypauSpace.md },
});
