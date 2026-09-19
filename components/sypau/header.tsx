import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type ReactNode } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SypauIcon } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauAsset, SypauColor, SypauSpace } from '@/constants/sypau';

/** The hand-drawn red X that sits above the wordmark on every branded screen. */
export function RedCross({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 4 L19 19.5"
        stroke={SypauColor.red}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 4.5 L4 19"
        stroke={SypauColor.red}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The scribbled underline beneath headings and the tagline. */
export function HandUnderline({ width = 130, color = SypauColor.red }: { width?: number; color?: string }) {
  return (
    <Svg width={width} height={10} viewBox="0 0 130 10">
      <Path
        d="M2 6 C 30 2, 70 9, 128 3"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M10 9 C 40 6, 80 10, 120 6"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.65}
      />
    </Svg>
  );
}

type HeaderProps = {
  title?: string;
  /** Shows the SYPAU wordmark instead of a plain title. */
  wordmark?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  /** Replaces the default hand emblem on the right. */
  right?: ReactNode;
};

/**
 * The torn strip across the top of every screen: back arrow, title, emblem.
 * Matches the create-zone and zone-detail references, where the header reads
 * as a piece of paper laid over the page rather than a system app bar.
 */
export function SypauHeader({ title, wordmark = false, showBack = false, onBack, right }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Grain opacity={0.16} />

      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => (onBack ? onBack() : router.back())}>
            <SypauIcon name="back" size={26} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <RedCross size={16} />
        {wordmark ? (
          <SypauText variant="displaySm" caps style={styles.wordmark}>
            SYPAU
          </SypauText>
        ) : (
          <SypauText variant="cardTitle" caps align="center">
            {title}
          </SypauText>
        )}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        {right ?? <Image source={SypauAsset.emblem} style={styles.emblem} contentFit="contain" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SypauSpace.gutter,
    paddingTop: SypauSpace.sm,
    paddingBottom: SypauSpace.md,
    backgroundColor: SypauColor.ink,
  },
  side: { width: 44, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  wordmark: { marginTop: -2 },
  emblem: { width: 38, height: 38 },
});
