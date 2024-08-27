import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/prism/button';
import { Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS } from '@/constants/settings-keys';
import { getDb } from '@/db/client';
import { setSetting } from '@/db/queries';

const STEPS = [
  { title: 'Draw', body: 'Trace a border on the map. Watch it fold into a place that matters.' },
  { title: 'Engage', body: 'Cross the perimeter and SYPAU quietly arms itself around you.' },
  { title: 'Restore', body: 'Step back out — everything returns exactly as you left it.' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const finish = async () => {
    await Location.requestForegroundPermissionsAsync();
    const db = getDb();
    setSetting(db, SETTINGS_KEYS.onboardingComplete, true);
    router.replace('/home');
    router.push('/fold/new');
  };

  return (
    <View style={styles.container}>
      <Animated.View key={step} entering={FadeIn.duration(350)} style={styles.stepCard}>
        <Text style={styles.stepIndex}>
          {step + 1} / {STEPS.length}
        </Text>
        <Text style={styles.title}>{STEPS[step].title}</Text>
        <Text style={styles.body}>{STEPS[step].body}</Text>
      </Animated.View>

      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {isLast ? (
          <Button onPress={finish}>Create first Fold</Button>
        ) : (
          <Button onPress={() => setStep((s) => s + 1)}>Next</Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
    padding: 28,
    justifyContent: 'flex-end',
    gap: 32,
  },
  stepCard: {
    gap: 12,
  },
  stepIndex: {
    ...PrismType.caption,
    color: '#8892A6',
    textTransform: 'uppercase',
  },
  title: {
    ...PrismType.h1,
    color: Prism.ashPaper,
  },
  body: {
    ...PrismType.body,
    color: '#B7BFCC',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(233,236,242,0.2)',
  },
  dotActive: {
    backgroundColor: Prism.cyan,
  },
  actions: {
    marginBottom: 12,
  },
});
