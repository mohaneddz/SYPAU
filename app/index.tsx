import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
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
 * Launch screen. The cover artwork fades up from black, holds, then fades back
 * out into the app — matching the cover reference rather than dropping the user
 * straight onto a dashboard.
 */
export default function SplashRoute() {
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);

  const coverOpacity = useSharedValue(0);
  const blackout = useSharedValue(1);

  const advance = () => {
    router.replace(settings.onboardingCompleted ? '/home' : '/onboarding');
  };

  useEffect(() => {
    if (!hydrated) return;

    // Fade in from black, hold on the artwork, then fade back to black before
    // the next screen mounts, so the transition reads as one move.
    blackout.value = withTiming(0, {
      duration: SypauMotion.coverFadeMs,
      easing: Easing.out(Easing.quad),
    });

    coverOpacity.value = withSequence(
      withTiming(1, { duration: SypauMotion.coverFadeMs, easing: Easing.out(Easing.quad) }),
      withDelay(
        SypauMotion.coverHoldMs,
        withTiming(0, { duration: SypauMotion.coverFadeMs, easing: Easing.in(Easing.quad) })
      )
    );

    blackout.value = withDelay(
      SypauMotion.coverFadeMs + SypauMotion.coverHoldMs,
      withTiming(1, { duration: SypauMotion.coverFadeMs }, (finished) => {
        if (finished) runOnJS(advance)();
      })
    );
    // `advance` closes over settings, which are settled once hydrated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.value }));
  const blackoutStyle = useAnimatedStyle(() => ({ opacity: blackout.value }));

  return (
    <Pressable style={styles.page} onPress={advance} accessibilityLabel="Enter SYPAU">
      <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
        <Image source={SypauAsset.cover} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      <View style={styles.footer} pointerEvents="none">
        <Animated.View style={coverStyle}>
          <SypauText variant="label" caps align="center" color={SypauColor.bone}>
            Tap to enter
          </SypauText>
          <HandUnderline width={120} color={SypauColor.cyan} />
        </Animated.View>
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
