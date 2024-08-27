import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { PrismMotion } from '@/constants/prism';

type PrismEdgeProps = PropsWithChildren<{
  color: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Wraps children with a slow "breathing" glow border — the active-Fold highlight. */
export function PrismEdge({ children, color, active = true, style }: PrismEdgeProps) {
  const breathe = useSharedValue(0.4);

  useEffect(() => {
    if (active) {
      breathe.value = withRepeat(
        withTiming(1, { duration: PrismMotion.breatheMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    } else {
      breathe.value = withTiming(0.4, { duration: PrismMotion.exitDissolveMs });
    }
  }, [active, breathe]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: color,
    opacity: breathe.value,
    shadowColor: color,
    shadowOpacity: breathe.value,
  }));

  return <Animated.View style={[styles.edge, animatedStyle, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  edge: {
    borderWidth: 1.5,
    borderRadius: 22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
