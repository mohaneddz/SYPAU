import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Prism, PrismRadii, PrismType } from '@/constants/prism';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Button({ children, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.label, variantTextStyles[variant]]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: PrismRadii.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...PrismType.body,
    fontWeight: '700',
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: Prism.cyan },
  secondary: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: 'rgba(255,107,107,0.16)' },
});

const variantTextStyles = StyleSheet.create({
  primary: { color: Prism.inkBlack },
  secondary: { color: Prism.ashPaper },
  ghost: { color: Prism.cyan },
  destructive: { color: '#FF6B6B' },
});
