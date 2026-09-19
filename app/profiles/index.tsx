import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { StatusChip } from '@/components/sypau/controls';
import { SypauConfirmDialog, SypauEmptyState } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon } from '@/components/sypau/icon';
import { effectsOf } from '@/components/sypau/profileEffects';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SypauText } from '@/components/sypau/text';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { countZonesUsingProfile } from '@/db/profiles';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useZoneStore } from '@/state/useZoneStore';
import type { Profile } from '@/types/profile';

export default function ProfilesRoute() {
  const profiles = useProfileStore((s) => s.profiles);
  const duplicate = useProfileStore((s) => s.duplicate);
  const remove = useProfileStore((s) => s.remove);
  const update = useProfileStore((s) => s.update);

  const zones = useZoneStore((s) => s.zones);
  const engine = useEngineStore((s) => s.engine);

  const [menuProfile, setMenuProfile] = useState<Profile | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const activeZone = zones.find((zone) => zone.id === engine.activeZoneId) ?? null;

  if (profiles.length === 0) {
    return (
      <SypauScaffold title="Profiles" showBack>
        <SypauEmptyState
          title="No profiles yet"
          description="A profile is how your phone should behave. Build one, then point a zone at it."
          actionLabel="Create a profile"
          onAction={() => router.push('/profiles/create')}
        />
      </SypauScaffold>
    );
  }

  const attemptDelete = (profile: Profile) => {
    const result = remove(profile.id);
    if (result.ok) {
      setPendingDelete(null);
      setMenuProfile(null);
      return;
    }

    setPendingDelete(null);
    setMenuProfile(null);
    setRefusal(refusalMessage(result.reason, result.zoneCount, profile.name));
  };

  return (
    <SypauScaffold
      wordmark
      showBack
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={() => router.push('/settings')}>
          <SypauIcon name="settings" size={22} />
        </Pressable>
      }>
      <View style={styles.heading}>
        <Display>Profiles</Display>
        <HandUnderline width={170} />
        <SypauText variant="hand" color={SypauColor.bone}>
          One place.
        </SypauText>
        <SypauText variant="body" color={SypauColor.boneMuted}>
          One state of mind.
        </SypauText>
      </View>

      {profiles.map((profile) => {
        const zoneCount = countZonesUsingProfile(profile.id);
        const effects = effectsOf(profile.config);
        const isLive = activeZone?.profileId === profile.id;

        return (
          <DarkCard
            key={profile.id}
            highlighted={isLive}
            onPress={() => router.push({ pathname: '/profiles/[id]', params: { id: profile.id } })}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <SypauIcon name={profile.icon} size={20} color={SypauColor.cyan} />
              </View>

              <View style={styles.cardTitle}>
                <SypauText variant="cardTitle" caps>
                  {profile.name}
                </SypauText>
                <SypauText variant="bodySm" color={SypauColor.boneMuted}>
                  {zoneCount === 0
                    ? 'Not used by a zone'
                    : `${zoneCount} ${zoneCount === 1 ? 'zone' : 'zones'}`}
                </SypauText>
              </View>

              <View style={styles.badges}>
                {isLive ? <StatusChip label="Live" tone="cyan" /> : null}
                {profile.isDefault ? <StatusChip label="Default" tone="neutral" dot={false} /> : null}
              </View>
            </View>

            <View style={styles.summary}>
              {effects.length === 0 ? (
                <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                  Changes nothing yet.
                </SypauText>
              ) : (
                effects.slice(0, 4).map((effect) => (
                  <View key={effect.key} style={styles.summaryChip}>
                    <SypauIcon name={effect.icon} size={12} color={SypauColor.boneMuted} />
                    <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
                      {effect.value}
                    </SypauText>
                  </View>
                ))
              )}
              {effects.length > 4 ? (
                <SypauText variant="labelSm" color={SypauColor.boneFaint}>
                  +{effects.length - 4}
                </SypauText>
              ) : null}
            </View>

            <View style={styles.cardActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${profile.name}`}
                hitSlop={8}
                onPress={() => setMenuProfile(profile)}>
                <SypauText variant="labelSm" caps color={SypauColor.boneMuted}>
                  Options
                </SypauText>
              </Pressable>
              <SypauIcon name="chevron" size={20} color={SypauColor.red} />
            </View>
          </DarkCard>
        );
      })}

      <SypauConfirmDialog
        visible={menuProfile !== null && pendingDelete === null}
        title={menuProfile?.name ?? ''}
        message="What would you like to do with this profile?"
        confirmLabel="Edit"
        cancelLabel="Close"
        onCancel={() => setMenuProfile(null)}
        onConfirm={() => {
          const profile = menuProfile;
          setMenuProfile(null);
          if (profile) {
            router.push({ pathname: '/profiles/[id]/edit', params: { id: profile.id } });
          }
        }}>
        <View style={styles.menuActions}>
          <MenuAction
            icon="copy"
            label="Duplicate"
            onPress={() => {
              if (menuProfile) duplicate(menuProfile.id);
              setMenuProfile(null);
            }}
          />
          {menuProfile && !menuProfile.isDefault ? (
            <MenuAction
              icon="check"
              label="Make default"
              onPress={() => {
                update(menuProfile.id, { isDefault: true });
                setMenuProfile(null);
              }}
            />
          ) : null}
          <MenuAction
            icon="trash"
            label="Delete"
            destructive
            onPress={() => setPendingDelete(menuProfile)}
          />
        </View>
      </SypauConfirmDialog>

      <SypauConfirmDialog
        visible={pendingDelete !== null}
        destructive
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        message="This can't be undone."
        confirmLabel="Delete profile"
        onCancel={() => {
          setPendingDelete(null);
          setMenuProfile(null);
        }}
        onConfirm={() => pendingDelete && attemptDelete(pendingDelete)}
      />

      <SypauConfirmDialog
        visible={refusal !== null}
        title="Can't delete this profile"
        message={refusal ?? ''}
        confirmLabel="Got it"
        cancelLabel="Close"
        onCancel={() => setRefusal(null)}
        onConfirm={() => setRefusal(null)}
      />
    </SypauScaffold>
  );
}

function refusalMessage(reason: string, zoneCount: number, name: string): string {
  switch (reason) {
    case 'inUse':
      return `${zoneCount} ${zoneCount === 1 ? 'zone uses' : 'zones use'} ${name}. Point ${
        zoneCount === 1 ? 'it' : 'them'
      } at another profile first, and this one can go.`;
    case 'isDefault':
      return `${name} is your default profile. Make another profile the default first.`;
    default:
      return 'This is your only profile — zones need something to point at.';
  }
}

function MenuAction({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: 'copy' | 'check' | 'trash';
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? SypauColor.red : SypauColor.bone;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuAction, pressed && styles.pressed]}>
      <SypauIcon name={icon} size={18} color={color} />
      <SypauText variant="label" caps color={color}>
        {label}
      </SypauText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { gap: SypauSpace.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: SypauRadius.pill,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, gap: 2 },
  badges: { gap: SypauSpace.xs, alignItems: 'flex-end' },

  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginTop: SypauSpace.md,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    borderRadius: SypauRadius.chip,
    paddingHorizontal: SypauSpace.sm,
    paddingVertical: 4,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SypauSpace.md,
    paddingTop: SypauSpace.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },

  menuActions: { gap: SypauSpace.xs, marginTop: SypauSpace.sm },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.md,
  },
  pressed: { opacity: 0.7 },
});
