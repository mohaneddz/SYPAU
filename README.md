![SYPAU](design/cover.webp)

# SYPAU

**SYPAU** is an Android automation app built around one idea: your phone should already know how to behave when you walk into a room.

You draw **Zones** on a map, attach a **Profile** to each, and SYPAU changes your device when you cross the line — Do Not Disturb on at the library, ringer silenced in class, alarms left exactly where you set them.

## How it works

- **Zones** are boundaries on a map: a circle, a polygon, or a freehand shape. Each one points at a profile and carries a priority, dwell delays and its own exit rule.
- **Profiles** are reusable sets of device intentions — ringer mode, per-stream volumes, Do Not Disturb, vibration, brightness, screen timeout. Every setting has an explicit *unchanged* state, so applying a profile only ever touches what you configured.
- **The engine** resolves which zone owns your phone when zones overlap (highest priority wins, ties to the smaller zone), and hands back only the controls it actually took.

### The part most automation apps get wrong

Leaving a bedroom while still inside the house should land you on the *house* profile, not on whatever your phone looked like before bedtime. SYPAU applies the incoming profile first, then releases only the controls the outgoing one held that the incoming one doesn't. Snapshots merge oldest-wins, so a nested zone still restores to the state from before SYPAU touched anything.

Alarms are treated separately from every other audio category. Silencing your ringer never silences your alarm unless you explicitly set alarm volume — that's the mistake that costs people a morning.

## What Android actually allows

Most of what an app like this wants to do is closed off. SYPAU reports the truth rather than faking it. Every control declares one of `availableDirectly`, `requiresPermission`, `requiresSettingsPanel` or `unsupported`, and the UI shows that per row.

| Control | Status |
| --- | --- |
| Do Not Disturb, ringer mode, all volume streams | Works, given Notification Policy access |
| Media and alarm volume | Works without extra permission |
| Brightness, screen timeout, ring vibration | Needs "modify system settings" |
| Wi‑Fi | User-only since Android 10 |
| Bluetooth | User-only since Android 13 |
| Mobile data, airplane mode | User-only, any version |

For the last three, SYPAU keeps your intention, marks it clearly, and opens the right settings panel. It never reports a change it didn't make.

## Background operation

Zones register with **Play Services geofencing** rather than polling GPS — the OS batches fences across every app and wakes SYPAU only on a real transition. A foreground location service runs only in high-accuracy mode, where geofencing alone isn't precise enough.

Polygons register as their bounding circle, since the platform only understands circles; the exact containment test runs when the transition wakes the app. Geofences don't survive a reboot, so a boot receiver re-arms monitoring when you've enabled it.

Transitions that arrive while no JS runtime is attached are queued natively and replayed on the next subscribe, so a crossing during a cold stretch isn't lost.

## Screens

Splash · Onboarding · Permission setup · Home · Zones · Zone detail · Create/edit zone · Profiles · Profile detail · Create/edit profile · Activity log · Settings · GPS debug

The visual identity — near-black textures, torn paper, the red X and the origami hands — comes from the reference designs in [`design/`](design/), which are the source of truth for the UI.

## Tech stack

Expo SDK 54 · React Native 0.81 · React 19 (new architecture) · expo-router · TypeScript · Zustand · expo-sqlite · MapLibre · expo-location + expo-task-manager · a local Expo module in **Kotlin** for the Android system layer

The native module (`modules/sypauSystem/`) owns capability detection, profile application and restore, geofence registration, the foreground service, the boot receiver and every settings intent. It's loaded optionally, so the app still renders in Expo Go — with system control honestly reported as unavailable.

## Getting started

```bash
pnpm install
```

System control and geofencing need a development build; they don't exist in Expo Go.

```bash
npx expo run:android
```

### Build notes

The NDK toolchain rejects JDK 24. Point `JAVA_HOME` at a JDK 21 — Android Studio's bundled `jbr` works:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
```

Building all four ABIs is slow and memory-hungry. For a single device, build just the one you need:

```bash
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```

## Tests

```bash
pnpm test
```

Covers zone resolution and overlap priority, the nested-zone walk (home → bedroom → home → away), state ownership and restore, dwell gating, boundary hysteresis, and the geometry maths.

```bash
pnpm typecheck
```

## Project layout

```
app/          screens (expo-router)          core/       engine, native bridge, monitoring
components/   UI, including sypau/           engine/     geometry and overlap resolution
state/        Zustand stores                 db/         SQLite per aggregate
modules/      the Kotlin Expo module         tasks/      background location task
design/       reference screens              tests/      engine and geometry tests
```

## Privacy

Location is processed on device and never leaves it. Zones, profiles and the activity log live in local SQLite. There's no account, no server and no analytics.
