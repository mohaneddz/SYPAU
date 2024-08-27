import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Prism, PrismType } from '@/constants/prism';

export type StatusChipVariant = 'armed' | 'idle' | 'holding';

const VARIANT_COLOR: Record<StatusChipVariant, string> = {
  armed: Prism.cyan,
  idle: '#8892A6',
  holding: Prism.amber,
};

export function StatusChip({ label, variant }: { label: string; variant: StatusChipVariant }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (variant === 'holding') {
      pulse.value = withRepeat(withTiming(0.4, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [variant, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const color = VARIANT_COLOR[variant];

  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.label, { color: Prism.ashPaper }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(13,17,28,0.85)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...PrismType.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
