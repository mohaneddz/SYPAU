import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';

type CreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreateZone: () => void;
  onCreateProfile: () => void;
};

/** What the centre button opens: the two things worth creating. */
export function CreateSheet({ visible, onClose, onCreateZone, onCreateProfile }: CreateSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + SypauSpace.xl }]}>
        <Grain opacity={0.14} />

        <View style={styles.handle} />

        <SypauText variant="section" caps color={SypauColor.boneMuted} style={styles.heading}>
          Create
        </SypauText>

        <Option
          icon="pin"
          title="Create Zone"
          description="Draw a boundary on the map."
          onPress={onCreateZone}
        />
        <Option
          icon="layers"
          title="Create Profile"
          description="Decide how your phone behaves."
          onPress={onCreateProfile}
        />
      </View>
    </Modal>
  );
}

function Option({
  icon,
  title,
  description,
  onPress,
}: {
  icon: SypauIconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <View style={styles.optionIcon}>
        <SypauIcon name={icon} size={22} color={SypauColor.red} />
      </View>
      <View style={styles.optionText}>
        <SypauText variant="cardTitle" caps>
          {title}
        </SypauText>
        <SypauText variant="bodySm" color={SypauColor.boneMuted}>
          {description}
        </SypauText>
      </View>
      <SypauIcon name="chevron" size={20} color={SypauColor.boneFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: SypauColor.surface,
    borderTopLeftRadius: SypauRadius.card * 2,
    borderTopRightRadius: SypauRadius.card * 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    paddingHorizontal: SypauSpace.gutter,
    paddingTop: SypauSpace.md,
    gap: SypauSpace.md,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.hairline,
    marginBottom: SypauSpace.sm,
  },
  heading: { marginBottom: SypauSpace.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.lg,
    paddingVertical: SypauSpace.md,
    paddingHorizontal: SypauSpace.md,
    borderRadius: SypauRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SypauColor.hairline,
    backgroundColor: SypauColor.surfaceRaised,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: SypauRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SypauColor.hairline,
  },
  optionText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
});
