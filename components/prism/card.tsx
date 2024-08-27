import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Prism, PrismRadii } from '@/constants/prism';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Prism.paperShadow,
    borderRadius: PrismRadii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(233,236,242,0.06)',
  },
});
