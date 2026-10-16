import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { RedButton, StatusChip } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { effectsOf, ProfileEffectRows } from '@/components/sypau/profileEffects';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SectionTitle, SypauText } from '@/components/sypau/text';
import { applyProfile } from '@/core/nativeBridge';
import { hasProblems, summarize } from '@/core/profileEngine';
import { controlLabel } from '@/core/zoneEngine';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useActivityStore } from '@/state/useActivityStore';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import type { ControlResult } from '@/types/capability';

export default function ProfileDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const profile = useProfileStore((s) => s.byId(id));
  const duplicate = useProfileStore((s) => s.duplicate);
  const remove = useProfileStore((s) => s.remove);
  const update = useProfileStore((s) => s.update);

  const zones = useZoneStore((s) => s.zones);
  const capabilities = useEngineStore((s) => s.capabilities);
  const log = useActivityStore((s) => s.log);

  const [pendingDelete, setPendingDelete] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [confirmManual, setConfirmManual] = useState(false);
  const [applyResults, setApplyResults] = useState<ControlResult[] | null>(null);

  const usedBy = useMemo(
    () => zones.filter((zone) => zone.profileId === id),
    [zones, id]
  );

  if (!profile) {
    return (
      <SypauScaffold title="Profile" showBack>
        <SypauText variant="body" color={SypauColor.boneMuted}>
          This profile no longer exists.
        </SypauText>
      </SypauScaffold>
    );
  }

  const effects = effectsOf(profile.config);

  /** Controls this profile wants that Android won't hand over directly. */
  const blockedControls = effects.filter(
    (effect) => capabilities[effect.key]?.status !== 'availableDirectly'
  );

  const runActivation = () => {
    const { results } = applyProfile(profile.config);
    const summary = summarize(results);

    setApplyResults(results);
    log({
      category: 'profile',
      title: `${profile.name} activated`,
      description: 'Activated by hand.',
      profileId: profile.id,
      severity: hasProblems(summary) ? 'warning' : 'success',
      metadata: { results },
    });
  };

  const activate = () => {
    // Warn before a manual activation that can't fully land, so "activated"
    // never means something different from what the user just read.
    if (blockedControls.length > 0) {
      setConfirmManual(true);
      return;
    }
    runActivation();
  };

  const attemptDelete = () => {
    const result = remove(profile.id);
    setPendingDelete(false);

    if (result.ok) {
      router.replace('/profiles');
      return;
    }

    setRefusal(
      result.reason === 'inUse'
        ? `${result.zoneCount} ${result.zoneCount === 1 ? 'zone uses' : 'zones use'} this profile. Point ${result.zoneCount === 1 ? 'it' : 'them'} elsewhere first.`
        : result.reason === 'isDefault'
          ? 'This is your default profile. Make another the default first.'
          : 'This is your only profile — zones need something to point at.'
    );
  };

  return (
    <SypauScaffold title="Profile" showBack>
      <View style={styles.hero}>
        <View style={styles.iconBadge}>
          <SypauIcon name={profile.icon} size={26} color={SypauColor.cyan} />
        </View>
        <View style={styles.flex}>
          <Display>{profile.name}</Display>
          <HandUnderline width={140} />
        </View>
      </View>

      <View style={styles.badges}>
        {profile.isDefault ? <StatusChip label="Default" tone="cyan" /> : null}
        <StatusChip
          label={`${usedBy.length} ${usedBy.length === 1 ? 'zone' : 'zones'}`}
          tone="neutral"
          dot={false}
        />
      </View>

      <SectionTitle>Used by</SectionTitle>
      <DarkCard>
        {usedBy.length === 0 ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            No zone points at this profile yet.
          </SypauText>
        ) : (
          usedBy.map((zone) => (
            <View key={zone.id} style={styles.zoneRow}>
              <SypauIcon name="pin" size={15} color={SypauColor.boneMuted} />
              <SypauText variant="body" style={styles.flex}>
                {zone.name}
              </SypauText>
              <SypauText variant="labelSm" caps color={SypauColor.boneFaint}>
                {zone.enabled ? 'Enabled' : 'Paused'}
              </SypauText>
            </View>
          ))
        )}
      </DarkCard>

      <SectionTitle>Actions</SectionTitle>
      <DarkCard>
        <ProfileEffectRows config={profile.config} capabilities={capabilities} />
      </DarkCard>

      {applyResults ? (
        <>
          <SectionTitle>Last activation</SectionTitle>
          <DarkCard>
            {applyResults
              .filter((result) => result.outcome !== 'skipped')
              .map((result) => (
                <View key={result.key} style={styles.resultRow}>
                  <SypauIcon
                    name={result.outcome === 'applied' ? 'check' : 'alert'}
                    size={14}
                    color={result.outcome === 'applied' ? SypauColor.green : SypauColor.amber}
                  />
                  <SypauText variant="bodySm" style={styles.flex}>
                    {controlLabel(result.key)}
                  </SypauText>
                  <SypauText
                    variant="labelSm"
                    caps
                    color={result.outcome === 'applied' ? SypauColor.green : SypauColor.amber}>
                    {outcomeLabel(result.outcome)}
                  </SypauText>
                </View>
              ))}
          </DarkCard>
        </>
      ) : null}

      <RedButton label="Activate now" onPress={activate} />

      <View style={styles.actions}>
        <RedButton
          label="Edit"
          variant="outline"
          onPress={() => router.push({ pathname: '/profiles/[id]/edit', params: { id: profile.id } })}
          style={styles.flex}
        />
        <RedButton
          label="Duplicate"
          variant="outline"
          onPress={() => {
            const copy = duplicate(profile.id);
            if (copy) router.replace({ pathname: '/profiles/[id]', params: { id: copy.id } });
          }}
          style={styles.flex}
        />
      </View>

      {!profile.isDefault ? (
        <RedButton
          label="Make default"
          variant="outline"
          onPress={() => update(profile.id, { isDefault: true })}
        />
      ) : null}

      <RedButton label="Delete profile" onPress={() => setPendingDelete(true)} />

      <SypauConfirmDialog
        visible={confirmManual}
        title="Some of this needs you"
        message={`Android won't let SYPAU change ${blockedControls
          .map((effect) => controlLabel(effect.key))
          .join(', ')} on its own. Everything else will apply.`}
        confirmLabel="Apply the rest"
        onCancel={() => setConfirmManual(false)}
        onConfirm={() => {
          setConfirmManual(false);
          runActivation();
        }}
      />

      <SypauConfirmDialog
        visible={pendingDelete}
        destructive
        title={`Delete ${profile.name}?`}
        message="This can't be undone."
        confirmLabel="Delete profile"
        onCancel={() => setPendingDelete(false)}
        onConfirm={attemptDelete}
      />

      <SypauConfirmDialog
        visible={refusal !== null}
        title="Can't delete this profile"
        message={refusal ?? ''}
        icon="info"
        confirmLabel="Got it"
        cancelLabel={null}
        onCancel={() => setRefusal(null)}
        onConfirm={() => setRefusal(null)}
      />
    </SypauScaffold>
  );
}

function outcomeLabel(outcome: ControlResult['outcome']): string {
  switch (outcome) {
    case 'applied':
      return 'Applied';
    case 'permissionRequired':
      return 'Needs access';
    case 'manualActionRequired':
      return 'Manual';
    case 'unsupported':
      return 'Unavailable';
    case 'failed':
      return 'Failed';
    default:
      return 'Skipped';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: SypauRadius.pill,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', gap: SypauSpace.sm },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.xs,
  },
  actions: { flexDirection: 'row', gap: SypauSpace.md },
});
