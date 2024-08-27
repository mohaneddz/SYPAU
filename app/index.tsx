import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { getDb } from '@/db/client';
import { getSetting } from '@/db/queries';
import { Prism, PrismType } from '@/constants/prism';
import { SETTINGS_KEYS } from '@/constants/settings-keys';

const SPLASH_DURATION_MS = 900;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const db = getDb();
      const onboardingComplete = getSetting(db, SETTINGS_KEYS.onboardingComplete, false);
      router.replace(onboardingComplete ? '/home' : '/onboarding');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.glyph}>
        <View style={styles.foldTop} />
        <View style={styles.foldBottom} />
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(300).duration(500)} style={styles.tagline}>
        Fold silence into places.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Prism.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  glyph: {
    width: 72,
    height: 72,
  },
  foldTop: {
    position: 'absolute',
    top: 0,
    width: 72,
    height: 36,
    backgroundColor: Prism.ashPaper,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    transform: [{ perspective: 400 }, { rotateX: '20deg' }],
  },
  foldBottom: {
    position: 'absolute',
    bottom: 0,
    width: 72,
    height: 36,
    backgroundColor: Prism.cyan,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    transform: [{ perspective: 400 }, { rotateX: '-20deg' }],
  },
  tagline: {
    ...PrismType.body,
    color: '#8892A6',
  },
});
