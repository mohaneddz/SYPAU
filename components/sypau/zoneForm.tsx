import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BoundaryEditor,
  draftToGeometry,
  geometryToDraft,
  type BoundaryDraft,
} from '@/components/sypau/boundaryEditor';
import { PaperCard } from '@/components/sypau/cards';
import { Segmented, SypauSwitch } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { HandUnderline, SypauHeader } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { effectsOf } from '@/components/sypau/profileEffects';
import { SectionTitle, SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauAsset, SypauColor, SypauFont, SypauRadius, SypauSpace } from '@/constants/sypau';
import { controlLabel } from '@/core/zoneEngine';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import type { Profile } from '@/types/profile';
import { ZONE_ICONS, type BoundaryType, type ExitBehavior, type Zone, type ZoneIcon } from '@/types/zone';

const NAME_LIMIT = 24;

const BOUNDARY_OPTIONS: { value: BoundaryType; label: string; icon: 'polygon' | 'radius' | 'freehand' }[] = [
  { value: 'polygon', label: 'Polygon', icon: 'polygon' },
  { value: 'radius', label: 'Radius', icon: 'radius' },
  { value: 'freehand', label: 'Freehand', icon: 'freehand' },
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
 *
 * Laid out as the create-zone reference: the map runs edge to edge under the
 * header, and the form is a sheet laid over its lower edge.
 */
export function ZoneForm({ existing }: ZoneFormProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const profiles = useProfileStore((s) => s.profiles);
  const createZone = useZoneStore((s) => s.create);
  const updateZone = useZoneStore((s) => s.update);
  const fix = useEngineStore((s) => s.fix);
  const keyboardHeight = useKeyboardHeight();

  const defaultProfileId = profiles.find((p) => p.isDefault)?.id ?? profiles[0]?.id ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<ZoneIcon>(existing?.icon ?? 'pin');
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
  const [advancedOpen, setAdvancedOpen] = useState(
    // Opened for an existing zone that already uses the advanced rules, so
    // what it does isn't hidden behind a fold.
    existing != null &&
      (existing.exitBehavior !== 'restorePrevious' ||
        existing.activationDelaySeconds > 0 ||
        existing.exitDelaySeconds > 0 ||
        existing.priority !== 10)
  );

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

  // Anything typed or drawn counts: losing a half-drawn boundary to a stray
  // back swipe is the one thing worth stopping someone for here.
  const dirty = existing
    ? name !== existing.name ||
      icon !== existing.icon ||
      profileId !== existing.profileId ||
      JSON.stringify(geometry) !== JSON.stringify(existing.geometry) ||
      exitBehavior !== existing.exitBehavior ||
      priority !== existing.priority ||
      activationDelay !== existing.activationDelaySeconds ||
      exitDelay !== existing.exitDelaySeconds ||
      enabled !== existing.enabled
    : name.trim().length > 0 ||
      (draft.type === 'radius' ? draft.center !== null : draft.points.length > 0);

  const saved = useRef(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (saved.current || !dirty) return;
      event.preventDefault();
      setPendingLeave(() => () => navigation.dispatch(event.data.action));
    });
  }, [navigation, dirty]);

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
    if (errors.length > 0 || !geometry || !profileId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    const input = {
      name: name.trim(),
      icon,
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

    saved.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (existing) {
      updateZone(existing.id, input);
      router.back();
      return;
    }

    const zone = createZone(input);
    router.replace({ pathname: '/zones/[id]', params: { id: zone.id } });
  };

  return (
    <View style={[styles.page, { paddingBottom: keyboardHeight }]}>
      <BoundaryEditor
        draft={draft}
        onChange={setDraft}
        userLocation={fix?.point ?? null}
        topInset={insets.top + 118}
        style={styles.editor}
      />

      {/* Laid over the map, so the boundary reads as drawn beneath the title. */}
      <View style={[styles.header, { paddingTop: insets.top }]} pointerEvents="box-none">
        <SypauHeader title={existing ? 'Edit Zone' : 'Create Zone'} showBack />
        <View style={styles.tagline} pointerEvents="none">
          <SypauText variant="hand" color={SypauColor.bone}>
            Draw your boundary.
          </SypauText>
          <HandUnderline width={90} />
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + SypauSpace.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Grain opacity={0.12} />

        <SectionTitle>Zone name</SectionTitle>
        <PaperCard seed={23} tearColor={SypauColor.surface} contentStyle={styles.inputCard}>
          <TextInput
            value={name}
            onChangeText={(next) => setName(next.slice(0, NAME_LIMIT))}
            placeholder="Peace Block"
            placeholderTextColor="rgba(20,20,18,0.4)"
            style={styles.input}
            maxLength={NAME_LIMIT}
            returnKeyType="done"
            accessibilityLabel="Zone name"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconRow}
          accessibilityRole="radiogroup"
          accessibilityLabel="Zone icon">
          {ZONE_ICONS.map((option) => {
            const selected = option === icon;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIcon(option);
                }}
                style={[styles.iconChoice, selected && styles.iconChoiceSelected]}>
                <SypauIcon
                  name={option}
                  size={18}
                  color={selected ? SypauColor.paperInk : SypauColor.boneMuted}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionTitle>Mute behaviour</SectionTitle>
        <BehaviourPicker profiles={profiles} value={profileId} onChange={setProfileId} />

        <SectionTitle>Boundary type</SectionTitle>
        <Segmented
          options={BOUNDARY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            icon: (
              <SypauIcon
                name={option.icon}
                size={18}
                color={option.value === boundaryType ? SypauColor.paperInk : SypauColor.boneMuted}
              />
            ),
          }))}
          value={boundaryType}
          onChange={changeBoundaryType}
        />

        {draft.type === 'radius' ? (
          <RadiusStepper
            value={draft.radiusMeters}
            onChange={(radiusMeters) => setDraft({ ...draft, radiusMeters })}
          />
        ) : null}

        <SectionTitle>Monitoring</SectionTitle>
        <View style={styles.toggleCard}>
          <SypauIcon name="dnd" size={22} color={SypauColor.red} />
          <View style={styles.enabledText}>
            <SypauText variant="label">Watch this zone</SypauText>
            <SypauText variant="bodySm" color={SypauColor.boneMuted}>
              {enabled
                ? 'Calls, pings and notifications follow the profile inside it.'
                : 'Kept on the map, but it never takes over your phone.'}
            </SypauText>
          </View>
          <SypauSwitch value={enabled} onValueChange={setEnabled} accessibilityLabel="Watch this zone" />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          onPress={() => setAdvancedOpen((open) => !open)}
          style={styles.advancedToggle}>
          <SectionTitle style={styles.flex}>Exit rules &amp; timing</SectionTitle>
          <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
            {advancedOpen ? 'Hide' : summariseAdvanced(exitBehavior, activationDelay, exitDelay, priority)}
          </SypauText>
          <View style={{ transform: [{ rotate: advancedOpen ? '90deg' : '0deg' }] }}>
            <SypauIcon name="chevron" size={16} color={SypauColor.boneMuted} />
          </View>
        </Pressable>

        {advancedOpen ? (
          <View style={styles.advanced}>
            <SypauText variant="label" caps color={SypauColor.boneMuted}>
              When I leave
            </SypauText>
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
          </View>
        ) : null}

        {attemptedSave && errors.length > 0 ? (
          <View style={styles.errors} accessibilityLiveRegion="polite">
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

        <ActivateButton label={existing ? 'Save zone' : 'Activate silence'} onPress={save} />
      </ScrollView>

      <SypauConfirmDialog
        visible={pendingLeave !== null}
        destructive
        icon="trash"
        title={existing ? 'Discard changes?' : 'Discard this zone?'}
        message={
          existing
            ? 'Your edits to this zone haven’t been saved.'
            : 'The boundary you’ve drawn hasn’t been saved yet.'
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const leave = pendingLeave;
          setPendingLeave(null);
          saved.current = true;
          leave?.();
        }}
      />
    </View>
  );
}

function summariseAdvanced(
  exit: ExitBehavior,
  activationDelay: number,
  exitDelay: number,
  priority: number
): string {
  const parts: string[] = [];
  if (exit !== 'restorePrevious') parts.push(EXIT_OPTIONS.find((o) => o.value === exit)?.label ?? '');
  if (activationDelay > 0 || exitDelay > 0) parts.push(`${activationDelay}s / ${exitDelay}s`);
  if (priority !== 10) parts.push(`P${priority}`);
  return parts.length > 0 ? parts.join(' · ') : 'Defaults';
}

/**
 * The reference's MUTE INSIDE / OUTSIDE / TOGGLE cards. Each card is a profile,
 * described by what it actually changes rather than by its name alone.
 */
function BehaviourPicker({
  profiles,
  value,
  onChange,
}: {
  profiles: Profile[];
  value: string | null;
  onChange: (next: string) => void;
}) {
  if (profiles.length === 0) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/profiles/create')}>
        <SypauText variant="bodySm" color={SypauColor.amber}>
          No profiles yet — tap to create one first.
        </SypauText>
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.behaviours}
      accessibilityRole="radiogroup">
      {profiles.map((profile) => {
        const selected = profile.id === value;
        const effects = effectsOf(profile.config);
        const summary =
          effects.length === 0
            ? 'Changes nothing yet.'
            : effects
                .slice(0, 2)
                .map((effect) => `${controlLabel(effect.key)} ${effect.value.toLowerCase()}`)
                .join(', ') + (effects.length > 2 ? '…' : '.');

        return (
          <Pressable
            key={profile.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${profile.name}. ${summary}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(profile.id);
            }}
            style={[styles.behaviour, selected && styles.behaviourSelected]}>
            {selected ? <Grain variant="paper" opacity={0.18} /> : null}
            <Image
              source={SypauAsset.emblem}
              style={[styles.behaviourEmblem, !selected && styles.behaviourEmblemIdle]}
              contentFit="contain"
            />
            <View style={styles.flex}>
              <SypauText
                variant="label"
                caps
                numberOfLines={1}
                color={selected ? SypauColor.paperInk : SypauColor.bone}>
                {profile.name}
              </SypauText>
              <SypauText
                variant="bodySm"
                numberOfLines={2}
                color={selected ? 'rgba(20,20,18,0.75)' : SypauColor.boneFaint}>
                {summary}
              </SypauText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The hand-lettered red slab at the foot of the reference, emblems either side. */
function ActivateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.activate, pressed && styles.activatePressed]}>
      <Grain opacity={0.22} />
      <Image source={SypauAsset.emblem} style={styles.activateEmblem} contentFit="contain" />
      <SypauText
        variant="hand"
        caps
        color={SypauColor.bone}
        numberOfLines={1}
        style={styles.activateLabel}>
        {label}
      </SypauText>
      <Image source={SypauAsset.emblem} style={styles.activateEmblem} contentFit="contain" />
    </Pressable>
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
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <SypauText variant="cardTitle" color={SypauColor.cyan} style={styles.stepperValue}>
          {value}
          {suffix}
        </SypauText>
        <StepButton
          icon="plus"
          label={`Increase ${label}`}
          disabled={value >= max}
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
  disabled,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && styles.stepButtonPressed,
        disabled && styles.disabled,
      ]}>
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
  profiles: Profile[];
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
  flex: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,13,13,0.82)',
  },
  tagline: { alignItems: 'center', paddingBottom: SypauSpace.sm, marginTop: -SypauSpace.sm },
  editor: { height: '54%' },
  sheet: {
    flex: 1,
    marginTop: -SypauSpace.xl,
    marginHorizontal: SypauSpace.sm,
    backgroundColor: SypauColor.surface,
    borderTopLeftRadius: SypauRadius.card + 4,
    borderTopRightRadius: SypauRadius.card + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
  },
  sheetContent: { padding: SypauSpace.lg, gap: SypauSpace.md },

  inputCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: SypauSpace.md },
  input: {
    flex: 1,
    color: SypauColor.paperInk,
    // The reference writes the name by hand on the paper strip.
    fontFamily: SypauFont.hand,
    fontSize: 28,
    paddingVertical: SypauSpace.xs,
  },

  iconRow: { gap: SypauSpace.sm, paddingVertical: 2 },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.ink,
  },
  iconChoiceSelected: { backgroundColor: SypauColor.paper, borderColor: SypauColor.paper },

  behaviours: { gap: SypauSpace.sm },
  behaviour: {
    width: 196,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    padding: SypauSpace.md,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.ink,
    overflow: 'hidden',
  },
  behaviourSelected: { backgroundColor: SypauColor.cyan, borderColor: SypauColor.cyan },
  behaviourEmblem: { width: 44, height: 40 },
  behaviourEmblemIdle: { opacity: 0.55 },

  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    padding: SypauSpace.md,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.ink,
  },
  enabledText: { flex: 1, gap: 2 },

  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.sm,
  },
  advanced: { gap: SypauSpace.md },

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
    backgroundColor: SypauColor.ink,
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
  disabled: { opacity: 0.35 },

  errors: { gap: SypauSpace.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.sm },

  activate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SypauSpace.md,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.lg,
    borderRadius: SypauRadius.button,
    backgroundColor: SypauColor.red,
    overflow: 'hidden',
  },
  activatePressed: { backgroundColor: SypauColor.redDeep },
  activateEmblem: { width: 34, height: 32 },
  activateLabel: { flexShrink: 1, fontSize: 27, lineHeight: 36, textAlign: 'center' },
});
