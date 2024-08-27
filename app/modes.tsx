import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/prism/button';
import { Card } from '@/components/prism/card';
import { Prism, PrismType } from '@/constants/prism';
import { useProfileStore } from '@/state/use-profile-store';
import type { AlarmIntensity } from '@/types/profile';

const INTENSITIES: AlarmIntensity[] = ['normal', 'gentle', 'silent'];

export default function ModesScreen() {
  const profiles = useProfileStore((state) => state.profiles);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const addCustomProfile = useProfileStore((state) => state.addCustomProfile);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const createCustom = () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give the new profile a name.');
      return;
    }
    const created = addCustomProfile(name, { alarmIntensity: 'gentle', vibrate: true, gentleConfirm: false });
    setNewName('');
    setExpandedId(created.id);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {profiles.map((profile) => {
        const expanded = expandedId === profile.id;
        return (
          <Card key={profile.id} style={styles.card}>
            <Pressable style={styles.cardHeader} onPress={() => setExpandedId(expanded ? null : profile.id)}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#8892A6" />
            </Pressable>

            {expanded && (
              <View style={styles.editor}>
                <Text style={styles.label}>Alarm intensity</Text>
                <View style={styles.row}>
                  {INTENSITIES.map((intensity) => (
                    <Pressable
                      key={intensity}
                      style={[styles.pill, profile.config.alarmIntensity === intensity && styles.pillSelected]}
                      onPress={() =>
                        updateProfile(profile.id, { config: { ...profile.config, alarmIntensity: intensity } })
                      }>
                      <Text
                        style={[
                          styles.pillText,
                          profile.config.alarmIntensity === intensity && styles.pillTextSelected,
                        ]}>
                        {intensity}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Vibrate</Text>
                  <Switch
                    value={profile.config.vibrate}
                    onValueChange={(v) => updateProfile(profile.id, { config: { ...profile.config, vibrate: v } })}
                    trackColor={{ true: Prism.cyan }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Require confirm to dismiss</Text>
                  <Switch
                    value={profile.config.gentleConfirm}
                    onValueChange={(v) =>
                      updateProfile(profile.id, { config: { ...profile.config, gentleConfirm: v } })
                    }
                    trackColor={{ true: Prism.cyan }}
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}

      <Card style={styles.card}>
        <Text style={styles.label}>New custom profile</Text>
        <View style={styles.newRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Focus Mode"
            placeholderTextColor="#6B7280"
            value={newName}
            onChangeText={setNewName}
          />
          <Button onPress={createCustom}>Add</Button>
        </View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    ...PrismType.body,
    color: Prism.ashPaper,
    fontWeight: '700',
  },
  editor: {
    gap: 12,
    marginTop: 4,
  },
  label: {
    ...PrismType.caption,
    color: '#8892A6',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: Prism.deepCharcoal,
    borderRadius: 12,
    paddingHorizontal: 12,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Prism.deepCharcoal,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Prism.ashPaper,
  },
});
