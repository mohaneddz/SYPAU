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
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/errorBoundary';
import { SypauColor } from '@/constants/sypau';
import { setupNotificationHandler } from '@/core/notify';
import { getDb } from '@/db/client';
import { pruneEvents } from '@/db/events';
import { seedStarterProfiles } from '@/db/profiles';
import { useActivityStore } from '@/state/useActivityStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import '@/tasks/locationTask';

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

  useEffect(() => {
    getDb();
    seedStarterProfiles();

    useSettingsStore.getState().hydrate();
    useProfileStore.getState().load();
    useZoneStore.getState().load();
    useActivityStore.getState().load();
    void setupNotificationHandler();

    // Retention trim on launch rather than on a timer: the log only grows
    // while the app is alive, so this is the moment it can have drifted.
    const { logRetentionDays } = useSettingsStore.getState().settings;
    pruneEvents(logRetentionDays);
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // The identity is carried by the type, so holding here avoids a flash of
  // system-font headings before the real faces land.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: SypauColor.ink }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <ErrorBoundary label="RootLayout">
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
