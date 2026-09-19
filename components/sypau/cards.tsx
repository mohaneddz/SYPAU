import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Grain } from '@/components/sypau/texture';
import { TornEdge } from '@/components/sypau/tornEdge';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';

type PaperCardProps = {
  children: ReactNode;
  /** Which edges tear. The home status strip tears top and bottom. */
  tear?: 'both' | 'top' | 'bottom' | 'none';
  seed?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Light card stock with a ragged edge — the home status strip and the zone
 * name field. The tear is drawn in the page colour so the card reads as torn
 * away rather than outlined.
 */
export function PaperCard({
  children,
  tear = 'both',
  seed = 1,
  style,
  contentStyle,
}: PaperCardProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const tearsTop = tear === 'both' || tear === 'top';
  const tearsBottom = tear === 'both' || tear === 'bottom';

  return (
    <View onLayout={onLayout} style={[styles.paperWrap, style]}>
      <View style={styles.paperBody}>
        <Grain variant="paper" />
        <View style={[styles.paperContent, contentStyle]}>{children}</View>
      </View>

      {tearsTop ? (
        <View style={styles.tearTop}>
          <TornEdge width={width} color={SypauColor.ink} facing="up" seed={seed} height={9} />
        </View>
      ) : null}
      {tearsBottom ? (
        <View style={styles.tearBottom}>
          <TornEdge width={width} color={SypauColor.ink} facing="down" seed={seed + 31} height={9} />
        </View>
      ) : null}
    </View>
  );
}

type DarkCardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Cyan border marks the card the user is currently inside. */
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Thin-outlined near-black card, the workhorse surface on every screen. */
export function DarkCard({ children, onPress, highlighted = false, style }: DarkCardProps) {
  const body = (
    <>
      <Grain />
      <View style={styles.darkContent}>{children}</View>
    </>
  );

  const cardStyle = [styles.darkCard, highlighted && styles.darkCardHighlighted, style];

  if (!onPress) return <View style={cardStyle}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No padding here on purpose: the tears are drawn *over* the paper's own
  // top and bottom edges, so an inset would leave them painting on the page
  // background instead, where they're invisible.
  paperWrap: {},
  paperBody: {
    backgroundColor: SypauColor.paper,
    overflow: 'hidden',
  },
  paperContent: {
    paddingHorizontal: SypauSpace.lg,
    paddingVertical: SypauSpace.md,
  },
  tearTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  tearBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  darkCard: {
    backgroundColor: SypauColor.surface,
    borderRadius: SypauRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    overflow: 'hidden',
  },
  darkCardHighlighted: {
    borderColor: SypauColor.cyanDim,
    borderWidth: 1,
  },
  darkContent: {
    padding: SypauSpace.lg,
  },
  pressed: { opacity: 0.75 },
});
