import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The ragged edge that makes a card read as torn paper rather than a rounded
 * rectangle. Drawn as a path so it stays crisp at any width.
 *
 * The jitter is seeded, so a given card tears the same way on every render —
 * a reshuffling edge on each re-render reads as a glitch.
 */
function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function tearPath(width: number, height: number, seed: number, facing: 'up' | 'down'): string {
  const random = seededRandom(seed);
  const steps = Math.max(8, Math.round(width / 14));
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    // Two overlaid frequencies keep the edge from looking like even zigzag.
    const coarse = random() * height * 0.55;
    const fine = random() * height * 0.3;
    const y = facing === 'down' ? height - (coarse + fine) : coarse + fine;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // The ink fills the side *away* from the card: above a top tear, below a
  // bottom one. Filling toward the card paints over the paper and leaves a
  // sliver of it showing beyond the tear, which reads as a black band.
  const close = facing === 'down' ? `L${width},${height} L0,${height} Z` : `L${width},0 L0,0 Z`;
  return `M${points.join(' L')} ${close}`;
}

type TornEdgeProps = {
  width: number;
  color: string;
  /** Depth of the tear. */
  height?: number;
  /** 'down' tears the bottom of a card, 'up' tears the top. */
  facing?: 'up' | 'down';
  seed?: number;
};

export function TornEdge({ width, color, height = 10, facing = 'down', seed = 1 }: TornEdgeProps) {
  const d = useMemo(() => tearPath(width, height, seed, facing), [width, height, seed, facing]);

  if (width <= 0) return null;

  return (
    <View pointerEvents="none" style={{ width, height }}>
      <Svg width={width} height={height}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}
