import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_CLEARANCE, SypauBottomNav } from '@/components/sypau/bottomNav';
import { CreateSheet } from '@/components/sypau/createSheet';
import { SypauHeader } from '@/components/sypau/header';
import { Grain } from '@/components/sypau/texture';
import { SypauColor, SypauSpace } from '@/constants/sypau';

type ScaffoldProps = {
  children: ReactNode;
  title?: string;
  wordmark?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  headerRight?: ReactNode;
  /** Hidden on the map editor, which needs the full screen. */
  showHeader?: boolean;
  showNav?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Page frame: textured background, torn header, custom bottom nav. */
export function SypauScaffold({
  children,
  title,
  wordmark = false,
  showBack = false,
  onBack,
  headerRight,
  showHeader = true,
  showNav = true,
  scroll = true,
  contentStyle,
}: ScaffoldProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const body = (
    <View style={[styles.content, !showNav && styles.contentNoNav, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.page}>
      <Grain opacity={0.1} />

      <View style={{ paddingTop: insets.top }}>
        {showHeader ? (
          <SypauHeader
            title={title}
            wordmark={wordmark}
            showBack={showBack}
            onBack={onBack}
            right={headerRight}
          />
        ) : null}
      </View>

      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.scroll}>{body}</View>
      )}

      {showNav ? <SypauBottomNav onCreatePress={() => setCreateOpen(true)} /> : null}

      <CreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreateZone={() => {
          setCreateOpen(false);
          router.push('/zones/create');
        }}
        onCreateProfile={() => {
          setCreateOpen(false);
          router.push('/profiles/create');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: SypauColor.ink },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    paddingHorizontal: SypauSpace.gutter,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
    gap: SypauSpace.lg,
    flexGrow: 1,
  },
  contentNoNav: { paddingBottom: SypauSpace.xl },
});
