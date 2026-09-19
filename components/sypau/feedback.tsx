import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { RedButton, StatusChip } from '@/components/sypau/controls';
import { HandUnderline } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
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

type PermissionRowProps = {
  icon: SypauIconName;
  title: string;
  description: string;
  granted: boolean;
  /** Shown instead of "needs access" when the platform simply can't do it. */
  unavailable?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * One requirement on the permissions screen: what it is, why SYPAU wants it,
 * where it currently stands, and the one button that moves it forward.
 */
export function SypauPermissionRow({
  icon,
  title,
  description,
  granted,
  unavailable = false,
  actionLabel = 'Grant',
  onAction,
}: PermissionRowProps) {
  const tone = granted ? 'cyan' : unavailable ? 'neutral' : 'amber';
  const label = granted ? 'Ready' : unavailable ? 'Unavailable' : 'Needs access';

  return (
    <DarkCard highlighted={granted}>
      <View style={styles.permissionRow}>
        <View style={styles.permissionIcon}>
          <SypauIcon
            name={granted ? 'check' : icon}
            size={20}
            color={granted ? SypauColor.cyan : SypauColor.boneMuted}
          />
        </View>

        <View style={styles.permissionText}>
          <SypauText variant="label" caps color={SypauColor.bone}>
            {title}
          </SypauText>
          <SypauText variant="bodySm" color={SypauColor.boneMuted}>
            {description}
          </SypauText>
          <StatusChip label={label} tone={tone} style={styles.permissionChip} />
        </View>
      </View>

      {!granted && !unavailable && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.permissionAction, pressed && styles.pressed]}>
          <SypauText variant="label" caps color={SypauColor.red}>
            {actionLabel}
          </SypauText>
          <SypauIcon name="chevron" size={16} color={SypauColor.red} />
        </Pressable>
      ) : null}
    </DarkCard>
  );
}

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function SypauConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialog}>
          <SypauText variant="cardTitle" caps color={destructive ? SypauColor.red : SypauColor.bone}>
            {title}
          </SypauText>
          <SypauText variant="body" color={SypauColor.boneMuted}>
            {message}
          </SypauText>

          {children}

          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.dialogCancel, pressed && styles.pressed]}>
              <SypauText variant="label" caps color={SypauColor.boneMuted}>
                {cancelLabel}
              </SypauText>
            </Pressable>

            <RedButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'solid' : 'outline'}
              style={styles.dialogConfirm}
            />
          </View>
        </View>
      </View>
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

  permissionRow: { flexDirection: 'row', gap: SypauSpace.lg },
  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: SypauRadius.pill,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: { flex: 1, gap: SypauSpace.xs },
  permissionChip: { marginTop: SypauSpace.xs },
  permissionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SypauSpace.xs,
    marginTop: SypauSpace.md,
    paddingTop: SypauSpace.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
  },

  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
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
    padding: SypauSpace.xl,
    gap: SypauSpace.md,
  },
  dialogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.md,
    marginTop: SypauSpace.sm,
  },
  dialogCancel: { paddingVertical: SypauSpace.lg, paddingHorizontal: SypauSpace.lg },
  dialogConfirm: { flex: 1 },

  pressed: { opacity: 0.75 },
});
