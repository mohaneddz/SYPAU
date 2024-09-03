import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/prism/card';
import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { ICON_TYPE_META } from '@/constants/icon-types';
import { geometryArea } from '@/engine/geo';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';

export default function FoldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fold = useFoldStore((state) => state.folds.find((f) => f.id === id));
  const toggleFold = useFoldStore((state) => state.toggleFold);
  const updateFold = useFoldStore((state) => state.updateFold);
  const removeFold = useFoldStore((state) => state.removeFold);
  const profiles = useProfileStore((state) => state.profiles);
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  const areaLabel = useMemo(() => {
    if (!fold) return '';
    const area = geometryArea(fold.geometry);
    if (area > 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    return `${Math.round(area)} m²`;
  }, [fold]);

  if (!fold) {
    return (
      <View style={styles.center}>
        <Text style={styles.missingText}>This Fold no longer exists.</Text>
      </View>
    );
  }

  const profile = profiles.find((p) => p.id === fold.profileId);
  const iconMeta = ICON_TYPE_META[fold.iconType];

  const confirmDelete = () => {
    Alert.alert('Delete Fold', `Delete "${fold.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeFold(fold.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { borderColor: EDGE_COLOR_HEX[fold.edgeColor] }]}>
          <MaterialIcons name={iconMeta.icon} size={24} color={EDGE_COLOR_HEX[fold.edgeColor]} />
        </View>
        <Text style={styles.title}>{fold.name}</Text>
        <Switch value={fold.enabled} onValueChange={() => toggleFold(fold.id)} trackColor={{ true: Prism.cyan }} />
      </View>

      <Card>
        <View style={styles.cardRowHeader}>
          <Text style={styles.cardLabel}>Geometry</Text>
          <Pressable onPress={() => router.push({ pathname: '/fold/new', params: { editId: fold.id } })}>
            <Text style={styles.changeLink}>Edit</Text>
          </Pressable>
        </View>
        <Text style={styles.cardValue}>
          {fold.geometry.type === 'circle' ? 'Circle' : 'Polygon'} · ~{areaLabel}
        </Text>
      </Card>

      <Card>
        <View style={styles.cardRowHeader}>
          <Text style={styles.cardLabel}>Profile</Text>
          <Pressable onPress={() => setShowProfilePicker((v) => !v)}>
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        </View>
        <Text style={styles.cardValue}>{profile?.name ?? 'Unassigned'}</Text>
        {showProfilePicker && (
          <View style={styles.chipRow}>
            {profiles.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.chip, fold.profileId === p.id && styles.chipSelected]}
                onPress={() => {
                  updateFold(fold.id, { profileId: p.id });
                  setShowProfilePicker(false);
                }}>
                <Text style={[styles.chipText, fold.profileId === p.id && styles.chipTextSelected]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardLabel}>Priority</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { priority: Math.max(1, fold.priority - 1) })}>
            <MaterialIcons name="remove" size={18} color={Prism.ashPaper} />
          </Pressable>
          <Text style={styles.stepperValue}>{fold.priority}</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { priority: Math.min(10, fold.priority + 1) })}>
            <MaterialIcons name="add" size={18} color={Prism.ashPaper} />
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={styles.cardRowHeader}>
          <Text style={styles.cardLabel}>Restore on exit</Text>
          <Switch
            value={fold.restoreOnExit}
            onValueChange={(v) => updateFold(fold.id, { restoreOnExit: v })}
            trackColor={{ true: Prism.cyan }}
          />
        </View>
        <Text style={styles.cardLabel}>Dwell to enter</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { dwellEnterMs: Math.max(0, fold.dwellEnterMs - 2000) })}>
            <MaterialIcons name="remove" size={18} color={Prism.ashPaper} />
          </Pressable>
          <Text style={styles.stepperValue}>{Math.round(fold.dwellEnterMs / 1000)}s</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { dwellEnterMs: Math.min(60000, fold.dwellEnterMs + 2000) })}>
            <MaterialIcons name="add" size={18} color={Prism.ashPaper} />
          </Pressable>
        </View>
        <Text style={styles.cardLabel}>Dwell to exit</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { dwellExitMs: Math.max(0, fold.dwellExitMs - 2000) })}>
            <MaterialIcons name="remove" size={18} color={Prism.ashPaper} />
          </Pressable>
          <Text style={styles.stepperValue}>{Math.round(fold.dwellExitMs / 1000)}s</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() => updateFold(fold.id, { dwellExitMs: Math.min(60000, fold.dwellExitMs + 2000) })}>
            <MaterialIcons name="add" size={18} color={Prism.ashPaper} />
          </Pressable>
        </View>
      </Card>

      <Pressable style={styles.deleteButton} onPress={confirmDelete}>
        <MaterialIcons name="delete-outline" size={18} color="#FF6B6B" />
        <Text style={styles.deleteText}>Delete Fold</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  center: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    color: '#8892A6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...PrismType.h2,
    color: Prism.ashPaper,
    flex: 1,
  },
  cardLabel: {
    ...PrismType.caption,
    color: '#8892A6',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardValue: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  cardRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLink: {
    color: Prism.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    backgroundColor: Prism.deepCharcoal,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: Prism.cyan,
  },
  chipText: {
    color: '#9AA3B2',
    fontSize: 13,
  },
  chipTextSelected: {
    color: Prism.ashPaper,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  deleteText: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
});
