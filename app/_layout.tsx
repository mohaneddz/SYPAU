import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { getDb } from '@/db/client';
import { Prism } from '@/constants/prism';
import { useFoldStore } from '@/state/use-fold-store';
import { useProfileStore } from '@/state/use-profile-store';
import '@/tasks/location-task';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Prism.inkBlack,
    card: Prism.deepCharcoal,
    text: Prism.ashPaper,
    border: 'rgba(233,236,242,0.08)',
    primary: Prism.cyan,
  },
};

export default function RootLayout() {
  useEffect(() => {
    getDb();
    useProfileStore.getState().load();
    useFoldStore.getState().load();
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Prism.deepCharcoal },
          headerTintColor: Prism.ashPaper,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Prism.inkBlack },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="fields" options={{ title: 'My Fields' }} />
        <Stack.Screen name="modes" options={{ title: 'Modes' }} />
        <Stack.Screen name="activity" options={{ title: 'Activity' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="fold/new" options={{ title: 'Create Fold', presentation: 'modal' }} />
        <Stack.Screen name="fold/[id]" options={{ title: 'Fold Detail' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
