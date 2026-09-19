import { Text, type TextProps, type TextStyle } from 'react-native';

import { SypauColor, SypauType } from '@/constants/sypau';

type Variant = keyof typeof SypauType;

type SypauTextProps = TextProps & {
  variant?: Variant;
  color?: string;
  /** Screen titles and card names are set in caps in every reference screen. */
  caps?: boolean;
  align?: TextStyle['textAlign'];
};

export function SypauText({
  variant = 'body',
  color = SypauColor.bone,
  caps = false,
  align,
  style,
  children,
  ...rest
}: SypauTextProps) {
  return (
    <Text
      style={[
        SypauType[variant],
        { color, textAlign: align },
        caps && { textTransform: 'uppercase' as const },
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}

/** Large condensed screen title, e.g. MY ZONES. */
export function Display(props: Omit<SypauTextProps, 'variant' | 'caps'>) {
  return <SypauText variant="display" caps {...props} />;
}

/** Handwritten accent line, e.g. "YOU ARE INSIDE THIS ZONE". */
export function Hand(props: Omit<SypauTextProps, 'variant'>) {
  return <SypauText variant="hand" color={SypauColor.red} {...props} />;
}

/** Spaced-out group header, e.g. CONTROL / DATA / PREFERENCES. */
export function SectionTitle(props: Omit<SypauTextProps, 'variant' | 'caps'>) {
  return <SypauText variant="section" color={SypauColor.boneMuted} caps {...props} />;
}

export function Label(props: Omit<SypauTextProps, 'variant'>) {
  return <SypauText variant="label" color={SypauColor.boneMuted} {...props} />;
}

export function Body(props: Omit<SypauTextProps, 'variant'>) {
  return <SypauText variant="body" color={SypauColor.boneMuted} {...props} />;
}
