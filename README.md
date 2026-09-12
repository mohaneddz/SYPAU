![SYPAU](screenshots/cover.avif)

# SYPAU

**SYPAU** ("Shut Your Phone Alarm Up," working name "Silence Origami") is an Android-focused geofencing app built with Expo, React Native, and TypeScript. Draw zones called **Folds** on a map, assign each one an alarm **Profile**, and SYPAU automatically goes gentle (vibrate/low volume) on your alarms and notifications while you're inside a Fold — then restores normal behavior when you leave.

It ships its own design system, **Prism**, built around a map-centric home screen, a "Command Ring" in place of a bottom tab bar, and a blueprint/paper-fold visual identity.

## Features

- Draw circular or polygon Folds on a map and resolve which zone is active on overlap
- Field Engine (`engine/field-engine.ts`, `engine/geo.ts`, `engine/overlap.ts`) handling dwell gating, GPS-drift holding, and enter/exit/overlap event logging
- Background location monitoring via `expo-task-manager` so geofencing keeps working while the app isn't in the foreground
- SYPAU-owned alarms that automatically go gentle inside a Fold
- Full screen set: Map Home, Command Ring nav, Activity, Alarms, Fields, Fold detail/new, Modes, Onboarding, Settings
- Fold geometry editing, a GPS debug view, and data export
- Custom Prism component library (button, card, command-ring, prism-edge, status-chip)

## Tech stack

Expo SDK 54 · React Native 0.81 · React 19 (new architecture) · expo-router v6 · TypeScript · Zustand · expo-sqlite · @maplibre/maplibre-react-native · expo-location + expo-task-manager (background geofencing) · expo-notifications · react-native-reanimated / gesture-handler · pnpm

## Current status

Active development, Android-focused. Map + geofencing MVP, the Field Engine, background location, and the SYPAU-alarm MVP all work and have been verified against real-device crashes (the most recent commit fixed a map-related crash found on a physical device).

Not yet implemented, by design of the current Expo-managed build:
- Forcing system Do Not Disturb or changing system ringer/alarm volume
- True native geofencing APIs (would need a custom dev client / native modules)
- Alarms don't actually ring under Expo Go — the Alarms screen says so; build a dev client (`npx expo run:android`) to test them firing

## Getting started

```bash
pnpm install
pnpm expo start
```

Background location and geofencing require permissions (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`) that only work in a development build, not Expo Go:

```bash
npx expo run:android
```

## Project layout

```
app/          screens (expo-router)        engine/       geofencing + field logic
components/   UI, including prism/         tasks/         background location + alarms
state/        Zustand stores                constants/     map style, routes
```

See `.idea/plan.md` for the fuller product/build plan.
