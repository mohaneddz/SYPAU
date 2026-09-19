import { Image } from 'expo-image';
import { router, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HandUnderline } from '@/components/sypau/header';
import { SypauText } from '@/components/sypau/text';
import { SypauAsset, SypauColor, SypauMotion, SypauSpace } from '@/constants/sypau';
import { useSettingsStore } from '@/state/useSettingsStore';

/**
 * Launch screen. The cover fades up from black, holds, then fades back out
 * into the app — matching the cover reference rather than dropping the user
 * straight onto a dashboard.
 */
export default function SplashRoute() {
  const blackout = useSharedValue(1);
  const navigated = useRef(false);
  // `router.replace` is a no-op until the root navigator has mounted. On a
  // cold start that can be several seconds, and a replace that quietly does
  // nothing would strand the user on this screen with no way forward.
  const rootNavigationKey = useRootNavigationState()?.key;

  // Navigation is driven by a plain timer rather than an animation callback.
  // A `runOnJS` hop out of the UI thread is one more thing that can fail, and
  // if it does the user is left staring at a black screen with no way out.
  const advance = useCallback(() => {
    if (navigated.current) return;

    // Read at the moment of navigation: if hydration hasn't finished the
    // defaults are correct anyway, so the splash never waits on the database.
    const { onboardingCompleted } = useSettingsStore.getState().settings;
    navigated.current = true;
    router.replace(onboardingCompleted ? '/home' : '/onboarding');
  }, []);

  useEffect(() => {
    if (!rootNavigationKey) return;

    const { coverFadeMs, coverHoldMs } = SypauMotion;

    // One overlay does the whole move: lift the black, hold on the artwork,
    // then lay it back down as the next screen takes over.
    blackout.value = withSequence(
      withTiming(0, { duration: coverFadeMs, easing: Easing.out(Easing.quad) }),
      withDelay(
        coverHoldMs,
        withTiming(1, { duration: coverFadeMs, easing: Easing.in(Easing.quad) })
      )
    );

    const timer = setTimeout(advance, coverFadeMs * 2 + coverHoldMs);
    return () => clearTimeout(timer);
  }, [advance, blackout, rootNavigationKey]);

  const blackoutStyle = useAnimatedStyle(() => ({ opacity: blackout.value }));

  return (
    <Pressable style={styles.page} onPress={advance} accessibilityLabel="Enter SYPAU">
      <Image source={SypauAsset.cover} style={StyleSheet.absoluteFill} contentFit="cover" />

      <View style={styles.footer} pointerEvents="none">
        <SypauText variant="label" caps align="center" color={SypauColor.bone}>
          Tap to enter
        </SypauText>
        <HandUnderline width={120} color={SypauColor.cyan} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.blackout, blackoutStyle]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: SypauSpace.xxl * 2,
    alignItems: 'center',
    gap: SypauSpace.xs,
  },
  blackout: { backgroundColor: '#000' },
});
