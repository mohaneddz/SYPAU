import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauColor, SypauMotion, SypauRadius, SypauSpace } from '@/constants/sypau';

type RedButtonProps = {
  label: string;
  onPress: () => void;
  sublabel?: string;
  disabled?: boolean;
  /** 'outline' is the secondary action next to a red primary. */
  variant?: 'solid' | 'outline';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The distressed red CTA: ACTIVATE SILENCE, SAVE ZONE, FORCE LOCATION UPDATE. */
export function RedButton({
  label,
  onPress,
  sublabel,
  disabled = false,
  variant = 'solid',
  icon,
  style,
}: RedButtonProps) {
  const solid = variant === 'solid';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.redButton,
        solid ? styles.redSolid : styles.redOutline,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {solid ? <Grain opacity={0.18} /> : null}
      <View style={styles.redButtonRow}>
        {icon ? <View style={styles.redButtonIcon}>{icon}</View> : null}
        <View style={styles.redButtonLabels}>
          <SypauText
            variant="cardTitle"
            caps
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            color={solid ? SypauColor.bone : SypauColor.red}
            align="center">
            {label}
          </SypauText>
          {sublabel ? (
            <SypauText
              variant="labelSm"
              caps
              align="center"
              color={solid ? 'rgba(236,234,230,0.82)' : SypauColor.boneMuted}>
              {sublabel}
            </SypauText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

type SypauSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Cyan for zone/automation state, red for debug and destructive toggles. */
  tone?: 'cyan' | 'red';
  accessibilityLabel?: string;
};

/** Chunky pill switch with an off-white knob, per the zones and settings refs. */
export function SypauSwitch({
  value,
  onValueChange,
  disabled = false,
  tone = 'cyan',
  accessibilityLabel,
}: SypauSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: SypauMotion.transitionMs });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 22 }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor:
      progress.value > 0.5
        ? tone === 'red'
          ? SypauColor.red
          : SypauColor.cyan
        : SypauColor.hairline,
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}>
      <Animated.View style={[styles.switchTrack, trackStyle, disabled && styles.disabled]}>
        <Animated.View style={[styles.switchKnob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

type StatusChipProps = {
  label: string;
  tone?: 'cyan' | 'red' | 'green' | 'amber' | 'neutral';
  /** Leading dot, as on ZONE ACTIVE and the debug Live indicator. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StatusChip({ label, tone = 'neutral', dot = true, style }: StatusChipProps) {
  const color = {
    cyan: SypauColor.cyan,
    red: SypauColor.red,
    green: SypauColor.green,
    amber: SypauColor.amber,
    neutral: SypauColor.boneMuted,
  }[tone];

  return (
    <View style={[styles.chip, { borderColor: color }, style]}>
      {dot ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <SypauText variant="labelSm" caps color={color}>
        {label}
      </SypauText>
    </View>
  );
}

type SegmentedProps<T extends string> = {
  options: { value: T; label: string; sublabel?: string; icon?: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** Boundary type and mute behaviour pickers on the create-zone sheet. */
export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            style={[
              styles.segment,
              selected && styles.segmentSelected,
              index > 0 && styles.segmentDivider,
            ]}>
            {option.icon ? <View style={styles.segmentIcon}>{option.icon}</View> : null}
            <View style={styles.segmentLabels}>
              <SypauText
                variant="label"
                caps
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                color={selected ? SypauColor.paperInk : SypauColor.bone}>
                {option.label}
              </SypauText>
              {option.sublabel ? (
                <SypauText
                  variant="bodySm"
                  color={selected ? 'rgba(20,20,18,0.72)' : SypauColor.boneFaint}>
                  {option.sublabel}
                </SypauText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  redButton: {
    borderRadius: SypauRadius.button,
    overflow: 'hidden',
    paddingVertical: SypauSpace.lg,
    paddingHorizontal: SypauSpace.lg,
  },
  redSolid: { backgroundColor: SypauColor.red },
  redOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SypauColor.red,
  },
  redButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  redButtonIcon: { marginRight: SypauSpace.md },
  redButtonLabels: { flexShrink: 1 },

  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: SypauRadius.pill,
    padding: 4,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.paper,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: SypauRadius.pill,
    paddingHorizontal: SypauSpace.md,
    paddingVertical: 6,
    gap: SypauSpace.sm,
  },
  chipDot: { width: 7, height: 7, borderRadius: SypauRadius.pill },

  segmented: {
    flexDirection: 'row',
    backgroundColor: SypauColor.surface,
    borderRadius: SypauRadius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SypauSpace.xs,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.sm,
  },
  segmentSelected: { backgroundColor: SypauColor.cyan },
  segmentDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: SypauColor.hairline,
  },
  segmentIcon: { width: 22, alignItems: 'center' },
  segmentLabels: { flexShrink: 1 },

  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
