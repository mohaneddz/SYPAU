import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Prism, PrismRadii } from '@/constants/prism';

type CommandRingProps = {
  onDrawFold: () => void;
  onMyFields: () => void;
  onModes: () => void;
};

const ACTIONS = [
  { key: 'drawFold', label: 'Draw Fold', icon: 'gesture' as const },
  { key: 'myFields', label: 'My Fields', icon: 'layers' as const },
  { key: 'modes', label: 'Modes', icon: 'tune' as const },
];

export function CommandRing({ onDrawFold, onMyFields, onModes }: CommandRingProps) {
  const [open, setOpen] = useState(false);

  const handlers: Record<string, () => void> = {
    drawFold: () => {
      setOpen(false);
      onDrawFold();
    },
    myFields: () => {
      setOpen(false);
      onMyFields();
    },
    modes: () => {
      setOpen(false);
      onModes();
    },
  };

  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '45deg' : '0deg', { duration: 220 }) }],
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      {open && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} pointerEvents="auto" />
      )}

      {open && (
        <View style={styles.actionsRow} pointerEvents="box-none">
          {ACTIONS.map((action, index) => (
            <Animated.View
              key={action.key}
              entering={FadeIn.delay(index * 40).springify()}
              exiting={FadeOut.duration(120)}
              style={styles.actionSlot}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                onPress={handlers[action.key]}>
                <MaterialIcons name={action.icon} size={22} color={Prism.inkBlack} />
              </Pressable>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Animated.View>
          ))}
        </View>
      )}

      <Animated.View style={mainButtonStyle}>
        <Pressable
          style={({ pressed }) => [styles.mainButton, pressed && styles.mainButtonPressed]}
          onPress={() => setOpen((v) => !v)}
          accessibilityLabel={open ? 'Close command ring' : 'Open command ring'}>
          <MaterialIcons name={open ? 'close' : 'auto-awesome-motion'} size={26} color={Prism.inkBlack} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const RING_SIZE = PrismRadii.commandRing * 2;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    alignItems: 'flex-end',
  },
  mainButton: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: Prism.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Prism.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  mainButtonPressed: {
    opacity: 0.85,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  actionSlot: {
    alignItems: 'center',
    gap: 6,
    width: 76,
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Prism.ashPaper,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    color: Prism.ashPaper,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
