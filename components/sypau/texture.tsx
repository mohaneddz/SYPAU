import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SypauTexture } from '@/constants/sypau';
import { useSettingsStore } from '@/state/useSettingsStore';

type GrainProps = {
  variant?: 'dark' | 'paper';
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tiled speckle laid over a surface to break up flat fills. Sits above the
 * surface and below its content, and never intercepts touches.
 *
 * Honours the "textures" appearance setting, so the whole app can drop to flat
 * fills without every surface needing its own branch.
 */
export function Grain({ variant = 'dark', opacity, style }: GrainProps) {
  const texturesEnabled = useSettingsStore((s) => s.settings.texturesEnabled);
  if (!texturesEnabled) return null;

  const source = variant === 'paper' ? SypauTexture.paperGrain : SypauTexture.grain;
  const resolved = opacity ?? (variant === 'paper' ? 0.22 : 0.13);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style, { opacity: resolved }]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Tiling reads as noise at any size; cover would stretch the speckle.
        contentPosition="top left"
      />
    </View>
  );
}
