import {
  Anton_400Regular,
  useFonts as useAnton,
} from '@expo-google-fonts/anton';
import { Caveat_700Bold, useFonts as useCaveat } from '@expo-google-fonts/caveat';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts as useInter } from '@expo-google-fonts/inter';
import { Oswald_500Medium, Oswald_600SemiBold, useFonts as useOswald } from '@expo-google-fonts/oswald';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/errorBoundary';
import { SypauColor } from '@/constants/sypau';
import { setupNotificationHandler } from '@/core/notify';
import { getDb } from '@/db/client';
import { useSypauEngine } from '@/hooks/useSypauEngine';
import { loadEngineState } from '@/db/engineState';
import { pruneEvents } from '@/db/events';
import { seedStarterProfiles } from '@/db/profiles';
import { useActivityStore } from '@/state/useActivityStore';
import { useEngineStore } from '@/state/useEngineStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import { seedBackgroundState } from '@/tasks/locationTask';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: SypauColor.ink,
    card: SypauColor.surface,
    text: SypauColor.bone,
    border: SypauColor.hairline,
    primary: SypauColor.red,
  },
};

export default function RootLayout() {
  const [antonLoaded] = useAnton({ Anton_400Regular });
  const [oswaldLoaded] = useOswald({ Oswald_500Medium, Oswald_600SemiBold });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_700Bold });
  const [caveatLoaded] = useCaveat({ Caveat_700Bold });

  const fontsLoaded = antonLoaded && oswaldLoaded && interLoaded && caveatLoaded;

  // Startup runs in an effect, where the error boundary can't reach it. A
  // failure here means no database, so it's surfaced rather than left to
  // present as an app that opens to nothing.
  const [initError, setInitError] = useState<string | null>(null);
  // Child effects run before this component's own, so the engine waits on this
  // rather than on mount order to know the stores are filled.
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    try {
      getDb();
      seedStarterProfiles();

      useSettingsStore.getState().hydrate();
      useProfileStore.getState().load();
      useZoneStore.getState().load();
      useActivityStore.getState().load();
      // Restored before the engine mounts, so a relaunch inside a zone carries
      // on from where it was instead of entering it again.
      const engineState = loadEngineState();
      useEngineStore.getState().setEngine(engineState);
      seedBackgroundState(engineState);
      void setupNotificationHandler();

      // Retention trim on launch rather than on a timer: the log only grows
      // while the app is alive, so this is the moment it can have drifted.
      const { logRetentionDays } = useSettingsStore.getState().settings;
      pruneEvents(logRetentionDays);
      setInitDone(true);
    } catch (error) {
      setInitError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (initError) return <StartupFailure message={initError} />;

  // The identity is carried by the type, so holding here avoids a flash of
  // system-font headings before the real faces land.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: SypauColor.ink }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <ErrorBoundary label="RootLayout">
          {initDone ? <EngineHost /> : null}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: SypauColor.ink },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="permissions" />
            <Stack.Screen name="home" />
            <Stack.Screen name="zones/index" />
            <Stack.Screen name="zones/create" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="zones/map" />
            <Stack.Screen name="zones/[id]/index" />
            <Stack.Screen name="zones/[id]/edit" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="profiles/index" />
            <Stack.Screen name="profiles/create" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="profiles/[id]/index" />
            <Stack.Screen name="profiles/[id]/edit" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="activity" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/permissions" />
            <Stack.Screen name="debug" />
          </Stack>
        </ErrorBoundary>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Runs the zone engine for as long as the UI is up, independent of which screen
 * is showing. Rendered only after startup succeeded, since the engine reads the
 * stores startup fills.
 */
function EngineHost() {
  useSypauEngine();
  return null;
}

/**
 * Shown when startup itself failed. Deliberately plain: it must render without
 * the fonts, database or stores the rest of the app assumes, because any of
 * those is what has just gone wrong.
 */
function StartupFailure({ message }: { message: string }) {
  return (
    <View style={styles.failure}>
      <Text style={styles.failureTitle}>SYPAU COULDN&rsquo;T START</Text>
      <Text style={styles.failureBody}>
        Something went wrong setting up local storage, so your zones and profiles
        couldn&rsquo;t be loaded.
      </Text>
      <Text style={styles.failureDetail}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  failure: {
    flex: 1,
    backgroundColor: SypauColor.ink,
    padding: 32,
    justifyContent: 'center',
    gap: 14,
  },
  failureTitle: { color: SypauColor.red, fontSize: 22, letterSpacing: 1 },
  failureBody: { color: SypauColor.bone, fontSize: 15, lineHeight: 22 },
  failureDetail: { color: SypauColor.boneFaint, fontSize: 13 },
});
