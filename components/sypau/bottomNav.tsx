import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';

type NavItem = {
  route: string;
  label: string;
  icon: SypauIconName;
  /** Other routes that should light this tab up. */
  matches?: string[];
};

const LEFT_ITEMS: NavItem[] = [
  { route: '/home', label: 'Home', icon: 'home' },
  { route: '/zones', label: 'Zones', icon: 'pin', matches: ['/zones'] },
];

const RIGHT_ITEMS: NavItem[] = [
  { route: '/activity', label: 'Activity', icon: 'activity' },
  { route: '/profiles', label: 'Profile', icon: 'user', matches: ['/profiles', '/settings'] },
];

type BottomNavProps = {
  onCreatePress: () => void;
};

/**
 * The custom bottom bar: an origami paper ridge with the red create button
 * punched through it, per the zones reference.
 */
export function SypauBottomNav({ onCreatePress }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (item: NavItem) => {
    const candidates = item.matches ?? [item.route];
    return candidates.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Pressable
        key={item.route}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        style={styles.tab}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.navigate(item.route as never);
        }}>
        <SypauIcon
          name={item.icon}
          size={22}
          color={active ? SypauColor.red : SypauColor.boneMuted}
        />
        <SypauText
          variant="bodySm"
          style={styles.tabLabel}
          color={active ? SypauColor.red : SypauColor.boneMuted}>
          {item.label}
        </SypauText>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Paper ridge sits above the bar, with the button rising out of it. */}
      <Image
        source={SypauAsset.navbarTop}
        style={styles.ridge}
        contentFit="fill"
        pointerEvents="none"
      />

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, SypauSpace.sm) }]}>
        <Grain opacity={0.15} />

        <View style={styles.row}>
          {LEFT_ITEMS.map(renderItem)}
          {/* Spacer the create button floats over. */}
          <View style={styles.tab} />
          {RIGHT_ITEMS.map(renderItem)}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        style={styles.createButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onCreatePress();
        }}>
        <Grain opacity={0.2} />
        <SypauIcon name="plus" size={30} color={SypauColor.bone} />
      </Pressable>
    </View>
  );
}

/** Height the scroll content should clear so the nav never covers it. */
export const BOTTOM_NAV_CLEARANCE = 118;

const RIDGE_HEIGHT = 46;
const BUTTON_SIZE = 62;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  ridge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 54,
    height: RIDGE_HEIGHT,
  },
  bar: {
    backgroundColor: SypauColor.inkDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SypauColor.hairline,
    paddingTop: SypauSpace.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  tabLabel: { fontSize: 12, lineHeight: 16 },
  createButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 46,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.red,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Lifts the button off the ridge so it reads as sitting in front of it.
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
