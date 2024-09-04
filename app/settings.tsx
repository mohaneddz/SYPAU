import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/prism/card';
import { Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS, type LocationAccuracyPreset } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import {
  exportAllData,
  getSetting,
  importAllData,
  resetAllData,
  setSetting,
  type DataSnapshot,
} from '@/db/queries';
import { useAlarmStore } from '@/state/use-alarm-store';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';
import {
  isBackgroundLocationRunning,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/tasks/background-location-controller';
import { scheduleAlarm } from '@/tasks/alarm-scheduler';

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
    setArmed(await isBackgroundLocationRunning());
    setAccuracy(getSetting<LocationAccuracyPreset>(db, SETTINGS_KEYS.locationAccuracy, 'balanced'));
    setShowGpsDebug(getSetting(db, SETTINGS_KEYS.showGpsDebug, false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleArmed = async (value: boolean) => {
    if (value) {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== Location.PermissionStatus.GRANTED) {
        await refresh();
        return;
      }
      await startBackgroundLocation(accuracy);
    } else {
      await stopBackgroundLocation();
    }
    setArmed(value);
    setSetting(getDb(), SETTINGS_KEYS.armed, value);
  };

  const selectAccuracy = async (preset: LocationAccuracyPreset) => {
    setAccuracy(preset);
    setSetting(getDb(), SETTINGS_KEYS.locationAccuracy, preset);
    if (armed) await startBackgroundLocation(preset);
  };

  const toggleGpsDebug = (value: boolean) => {
    setShowGpsDebug(value);
    setSetting(getDb(), SETTINGS_KEYS.showGpsDebug, value);
  };

  const reloadAllStores = () => {
    useProfileStore.getState().load();
    useFoldStore.getState().load();
    useAlarmStore.getState().load();
  };

  const exportData = async () => {
    try {
      const snapshot = exportAllData(getDb());
      const file = new File(Paths.cache, `sypau-export-${Date.now()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export SYPAU data' });
      } else {
        Alert.alert('Exported', `Saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      Alert.alert(
        'Replace all data?',
        `Importing "${asset.name}" will replace all current Folds, profiles, and alarms. This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              try {
                const text = await (await fetch(asset.uri)).text();
                const snapshot = JSON.parse(text) as DataSnapshot;
                if (snapshot.version !== 1 || !Array.isArray(snapshot.folds) || !Array.isArray(snapshot.profiles)) {
                  Alert.alert('Invalid file', 'This does not look like a SYPAU export.');
                  return;
                }
                importAllData(getDb(), snapshot);
                reloadAllStores();
                for (const alarm of snapshot.alarms) {
                  if (alarm.enabled) scheduleAlarm(alarm);
                }
                Alert.alert('Import complete', 'Your data has been replaced.');
              } catch (err) {
                Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    }
  };

  const confirmResetAllData = () => {
    Alert.alert(
      'Reset all data?',
      'This permanently deletes every Fold, profile, alarm, and activity log. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAllData(getDb());
            reloadAllStores();
          },
        },
      ]
    );
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

      <Pressable onPress={() => router.push('/activity')}>
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Activity</Text>
              <Text style={styles.cardSubtitle}>Timeline of enters, exits, and drift holds</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#8892A6" />
          </View>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/alarms')}>
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Alarms</Text>
              <Text style={styles.cardSubtitle}>SYPAU-owned alarms that go gentle inside a Fold</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#8892A6" />
          </View>
        </Card>
      </Pressable>

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
        <Text style={styles.cardTitle}>Data</Text>
        <Text style={styles.cardSubtitle}>Export your Folds, profiles, and alarms as JSON, or restore from a file.</Text>
        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={exportData}>
            <Text style={styles.secondaryButtonText}>Export</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={importData}>
            <Text style={styles.secondaryButtonText}>Import</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.cardSubtitle}>SYPAU v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.dangerTitle}>Danger zone</Text>
        <Pressable style={styles.dangerButton} onPress={confirmResetAllData}>
          <Text style={styles.dangerButtonText}>Reset all data</Text>
        </Pressable>
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
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Prism.ashPaper,
    fontWeight: '700',
    fontSize: 13,
  },
  dangerTitle: {
    ...PrismType.caption,
    color: '#FF6B6B',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  dangerButton: {
    alignSelf: 'flex-start',
  },
  dangerButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
});
