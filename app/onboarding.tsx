import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RedButton } from '@/components/sypau/controls';
import { HandUnderline, RedCross } from '@/components/sypau/header';
import { SypauIcon, type SypauIconName } from '@/components/sypau/icon';
import { SypauText } from '@/components/sypau/text';
import { Grain } from '@/components/sypau/texture';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { useSettingsStore } from '@/state/useSettingsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Page = {
  icon: SypauIconName;
  title: string;
  tagline: string;
  body: string;
};

/**
 * Four short pages. The last one explains why SYPAU asks for background
 * location *before* the permission screen asks for it — a cold permission
 * prompt with no reason attached is the one people deny.
 */
const PAGES: Page[] = [
  {
    icon: 'pin',
    title: 'Create your zones',
    tagline: 'Draw your boundary.',
    body: 'Mark the places that matter — home, campus, the library. A zone is just a shape on a map.',
  },
  {
    icon: 'layers',
    title: 'Build profiles',
    tagline: 'One state of mind.',
    body: 'Decide how your phone should behave. Silent ringer, Do Not Disturb, media down — alarms only if you say so.',
  },
  {
    icon: 'zap',
    title: 'SYPAU takes over',
    tagline: 'We keep it that way.',
    body: 'Walk in and your profile activates. Walk out and your phone goes back to how you left it.',
  },
  {
    icon: 'lock',
    title: 'Background access',
    tagline: 'Why we ask.',
    body: 'SYPAU has to notice you crossing a boundary while the app is closed. That needs background location, and it never leaves your phone.',
  },
];

export default function OnboardingRoute() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const update = useSettingsStore((s) => s.update);

  const isLast = page === PAGES.length - 1;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== page) setPage(next);
  };

  const advance = () => {
    if (!isLast) {
      scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_WIDTH, animated: true });
      return;
    }
    update({ onboardingCompleted: true });
    router.replace('/permissions');
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Grain opacity={0.1} />

      <View style={styles.brand}>
        <RedCross size={16} />
        <SypauText variant="displaySm" caps>
          SYPAU
        </SypauText>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}>
        {PAGES.map((entry) => (
          <View key={entry.title} style={styles.slide}>
            <Image source={SypauAsset.emblem} style={styles.emblem} contentFit="contain" />

            <View style={styles.iconBadge}>
              <SypauIcon name={entry.icon} size={24} color={SypauColor.cyan} />
            </View>

            <SypauText variant="displaySm" caps align="center">
              {entry.title}
            </SypauText>
            <HandUnderline width={150} />

            <SypauText variant="hand" color={SypauColor.red} align="center">
              {entry.tagline}
            </SypauText>

            <SypauText
              variant="body"
              color={SypauColor.boneMuted}
              align="center"
              style={styles.body}>
              {entry.body}
            </SypauText>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SypauSpace.xl }]}>
        <View style={styles.dots}>
          {PAGES.map((entry, index) => (
            <View
              key={entry.title}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>

        <RedButton label={isLast ? 'Set up access' : 'Next'} onPress={advance} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: SypauColor.ink },
  brand: { alignItems: 'center', gap: 2, paddingVertical: SypauSpace.lg },
  pager: { flex: 1 },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SypauSpace.xl,
    gap: SypauSpace.md,
  },
  emblem: { width: 130, height: 110, marginBottom: SypauSpace.lg },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: SypauRadius.pill,
    borderWidth: 1,
    borderColor: SypauColor.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SypauSpace.sm,
  },
  body: { maxWidth: 320, marginTop: SypauSpace.sm },
  footer: { paddingHorizontal: SypauSpace.gutter, gap: SypauSpace.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SypauSpace.sm },
  dot: {
    width: 7,
    height: 7,
    borderRadius: SypauRadius.pill,
    backgroundColor: SypauColor.hairline,
  },
  dotActive: { backgroundColor: SypauColor.red, width: 20 },
});
