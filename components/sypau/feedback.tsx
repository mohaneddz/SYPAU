import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { RedButton } from '@/components/sypau/controls';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { TornEdge } from '@/components/sypau/tornEdge';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Folded-map art for zone lists, the hand emblem elsewhere. */
  art?: 'map' | 'emblem';
};

export function SypauEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  art = 'emblem',
}: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Image
        source={art === 'map' ? SypauAsset.foldedMap : SypauAsset.emblem}
        style={styles.emptyArt}
        contentFit="contain"
      />

      <SypauText variant="displaySm" caps align="center">
        {title}
      </SypauText>
      <HandUnderline width={160} />

      <SypauText variant="body" color={SypauColor.boneMuted} align="center" style={styles.emptyBody}>
        {description}
      </SypauText>

      {actionLabel && onAction ? (
        <RedButton label={actionLabel} onPress={onAction} style={styles.emptyAction} />
      ) : null}
    </View>
  );
}

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** `null` for a notice: one button, since two that both close is a riddle. */
  cancelLabel?: string | null;
  destructive?: boolean;
  /** The medallion above the title. Defaults to a warning for destructive dialogs. */
  icon?: SypauIconName;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/**
 * Every confirmation and notice in the app. A torn strip of card stock with
 * its subject in a medallion, rising in rather than popping, and cancelled by
 * the back gesture or a tap outside — never by accident on the primary action.
 */
export function SypauConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const [width, setWidth] = useState(0);
  const medallion = icon ?? (destructive ? 'alert' : null);
  const accent = destructive ? SypauColor.red : SypauColor.cyan;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Animated.View entering={FadeIn.duration(160)} style={styles.dialogBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

        <Animated.View
          entering={FadeInDown.duration(200)}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.dialog}
          accessibilityViewIsModal
          accessibilityRole="alert">
          <Grain opacity={0.14} />
          <View style={[styles.dialogAccent, { backgroundColor: accent }]} />
          <View style={styles.dialogTear}>
            <TornEdge width={width} color="rgba(0,0,0,0.75)" facing="up" seed={7} height={8} />
          </View>

          <View style={styles.dialogBody}>
            {medallion ? (
              <View style={[styles.medallion, { borderColor: accent }]}>
                <SypauIcon name={medallion} size={22} color={accent} />
              </View>
            ) : null}

            <SypauText
              variant="cardTitle"
              caps
              align={medallion ? 'center' : undefined}
              color={destructive ? SypauColor.red : SypauColor.bone}>
              {title}
            </SypauText>
            <SypauText
              variant="body"
              align={medallion ? 'center' : undefined}
              color={SypauColor.boneMuted}>
              {message}
            </SypauText>

            {children}

            <View style={styles.dialogActions}>
              {cancelLabel !== null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onCancel}
                  style={({ pressed }) => [styles.dialogCancel, pressed && styles.pressed]}>
                  <SypauText variant="label" caps color={SypauColor.boneMuted}>
                    {cancelLabel}
                  </SypauText>
                </Pressable>
              ) : null}

              <RedButton
                label={confirmLabel}
                onPress={onConfirm}
                variant={destructive || cancelLabel === null ? 'solid' : 'outline'}
                style={styles.dialogConfirm}
              />
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SypauSpace.md,
    paddingVertical: SypauSpace.xxl * 2,
  },
  emptyArt: { width: 150, height: 120, opacity: 0.9 },
  emptyBody: { maxWidth: 280 },
  emptyAction: { alignSelf: 'stretch', marginTop: SypauSpace.lg },

  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SypauSpace.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: SypauColor.surface,
    borderRadius: SypauRadius.card,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    overflow: 'hidden',
  },
  dialogAccent: { height: 3 },
  dialogTear: { position: 'absolute', top: 3, left: 0, right: 0 },
  dialogBody: { padding: SypauSpace.xl, paddingTop: SypauSpace.xl + SypauSpace.xs, gap: SypauSpace.md },
  medallion: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SypauColor.ink,
  },
  dialogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    marginTop: SypauSpace.sm,
  },
  dialogCancel: { paddingVertical: SypauSpace.lg, paddingHorizontal: SypauSpace.sm },
  dialogConfirm: { flex: 1, paddingHorizontal: SypauSpace.md },

  pressed: { opacity: 0.75 },
});
