import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/prism/card';
import { Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS, type LocationAccuracyPreset } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import { getSetting, setSetting } from '@/db/queries';

const ACCURACY_PRESETS: LocationAccuracyPreset[] = ['battery', 'balanced', 'precise'];

export default function SettingsScreen() {
  const [foregroundGranted, setForegroundGranted] = useState(false);
  const [backgroundGranted, setBackgroundGranted] = useState(false);
  const [armed, setArmed] = useState(false);
  const [accuracy, setAccuracy] = useState<LocationAccuracyPreset>('balanced');
  const [showGpsDebug, setShowGpsDebug] = useState(false);

  const refresh = useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    setForegroundGranted(fg.status === Location.PermissionStatus.GRANTED);
    setBackgroundGranted(bg.status === Location.PermissionStatus.GRANTED);

    const db = getDb();
    setArmed(getSetting(db, SETTINGS_KEYS.armed, false));
    setAccuracy(getSetting<LocationAccuracyPreset>(db, SETTINGS_KEYS.locationAccuracy, 'balanced'));
    setShowGpsDebug(getSetting(db, SETTINGS_KEYS.showGpsDebug, false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleArmed = (value: boolean) => {
    setArmed(value);
    setSetting(getDb(), SETTINGS_KEYS.armed, value);
  };

  const selectAccuracy = (preset: LocationAccuracyPreset) => {
    setAccuracy(preset);
    setSetting(getDb(), SETTINGS_KEYS.locationAccuracy, preset);
  };

  const toggleGpsDebug = (value: boolean) => {
    setShowGpsDebug(value);
    setSetting(getDb(), SETTINGS_KEYS.showGpsDebug, value);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Permissions</Text>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Foreground location</Text>
          {foregroundGranted ? (
            <Text style={styles.grantedText}>Granted</Text>
          ) : (
            <Pressable
              onPress={async () => {
                await Location.requestForegroundPermissionsAsync();
                refresh();
              }}>
              <Text style={styles.grantLink}>Grant</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionLabel}>Background location</Text>
          {backgroundGranted ? (
            <Text style={styles.grantedText}>Granted</Text>
          ) : (
            <Pressable
              onPress={async () => {
                await Location.requestBackgroundPermissionsAsync();
                refresh();
              }}>
              <Text style={styles.grantLink}>Grant</Text>
            </Pressable>
          )}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Armed</Text>
            <Text style={styles.cardSubtitle}>Monitor Folds in the background</Text>
          </View>
          <Switch value={armed} onValueChange={toggleArmed} trackColor={{ true: Prism.cyan }} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Location accuracy</Text>
        <View style={styles.row}>
          {ACCURACY_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              style={[styles.pill, accuracy === preset && styles.pillSelected]}
              onPress={() => selectAccuracy(preset)}>
              <Text style={[styles.pillText, accuracy === preset && styles.pillTextSelected]}>{preset}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.cardTitle}>Show GPS debug</Text>
          <Switch value={showGpsDebug} onValueChange={toggleGpsDebug} trackColor={{ true: Prism.cyan }} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.cardSubtitle}>SYPAU v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    gap: 10,
  },
  cardTitle: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...PrismType.caption,
    color: '#8892A6',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionLabel: {
    ...PrismType.body,
    color: '#B7BFCC',
  },
  grantedText: {
    color: Prism.cyan,
    fontWeight: '700',
    fontSize: 13,
  },
  grantLink: {
    color: Prism.cyan,
    fontWeight: '700',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: Prism.deepCharcoal,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillSelected: {
    borderColor: Prism.cyan,
  },
  pillText: {
    color: '#9AA3B2',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  pillTextSelected: {
    color: Prism.ashPaper,
    fontWeight: '700',
  },
});
