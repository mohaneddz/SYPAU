import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { EDGE_COLOR_HEX, Prism, PrismType } from '@/constants/prism';
import { ICON_TYPE_META } from '@/constants/icon-types';
import { distanceToGeometry } from '@/engine/geo';
import { useEngineStore } from '@/state/use-engine-store';
import { useFoldStore } from '@/state/use-fold-store';
import type { Fold } from '@/types/fold';

const NEARBY_THRESHOLD_METERS = 300;

function statusFor(fold: Fold, resolvedFoldId: string | null, currentLocation: ReturnType<typeof useEngineStore.getState>['currentLocation']) {
  if (fold.id === resolvedFoldId) return 'Active now';
  if (currentLocation && distanceToGeometry(currentLocation, fold.geometry) <= NEARBY_THRESHOLD_METERS) {
    return 'Nearby';
  }
  return 'Idle';
}

export default function FieldsScreen() {
  const folds = useFoldStore((state) => state.folds);
  const toggleFold = useFoldStore((state) => state.toggleFold);
  const resolvedFoldId = useEngineStore((state) => state.resolvedFoldId);
  const currentLocation = useEngineStore((state) => state.currentLocation);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => folds.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())),
    [folds, query]
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color="#8892A6" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Folds"
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No Folds yet. Draw one from the command ring.</Text>}
        renderItem={({ item }) => {
          const meta = ICON_TYPE_META[item.iconType];
          const status = statusFor(item, resolvedFoldId, currentLocation);
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/fold/[id]', params: { id: item.id } })}>
              <View style={[styles.iconBadge, { borderColor: EDGE_COLOR_HEX[item.edgeColor] }]}>
                <MaterialIcons name={meta.icon} size={20} color={EDGE_COLOR_HEX[item.edgeColor]} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={[styles.rowStatus, status === 'Active now' && styles.rowStatusActive]}>{status}</Text>
              </View>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
              <Switch value={item.enabled} onValueChange={() => toggleFold(item.id)} trackColor={{ true: Prism.cyan }} />
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/fold/new')}>
        <MaterialIcons name="add" size={26} color={Prism.inkBlack} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Prism.paperShadow,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Prism.ashPaper,
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  emptyText: {
    color: '#8892A6',
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Prism.paperShadow,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  rowStatus: {
    ...PrismType.caption,
    color: '#8892A6',
  },
  rowStatusActive: {
    color: Prism.cyan,
  },
  priorityBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: Prism.ashPaper,
    fontSize: 12,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Prism.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Prism.cyan,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
