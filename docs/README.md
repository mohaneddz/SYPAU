# SYPAU Project

**Fold silence into places — SYPAU arms gentle alarm profiles around the map zones you draw.**

## Overview

SYPAU is a React Native mobile application built with Expo that lets users create custom geographic zones ("Folds") on a map and attach silent/gentle alarm profiles to them. When you enter or leave a Fold, the app can trigger notifications and manage your alarm settings automatically.

## Key Features

- **Map-based Zone Creation**: Draw custom geographic boundaries (Folds) on an interactive map using MapLibre
- **Gentle Alarms**: Create and manage alarm profiles that silence or adjust notification behavior
- **Location Tracking**: Real-time background location tracking to detect entry/exit from Folds
- **Notifications**: Smart notification system that respects your Fold-based profiles
- **Data Management**: Export and import your Fold data
- **GPS Debug Tools**: Built-in GPS debugging for troubleshooting location features

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based), with a custom "Command Ring" in place of a bottom tab bar
- **Mapping**: MapLibre React Native
- **Storage**: Expo SQLite (local database)
- **Location**: Expo Location with background task support
- **Notifications**: Expo Notifications
- **State Management**: Zustand

## Project Structure

```
├── app/              # App routes and screens (Expo Router)
├── constants/        # App constants and configuration
├── engine/           # Core business logic (geolocation, alarm handling)
├── utils/            # Utility functions
├── assets/           # Images, icons, splash screen
├── docs/             # Documentation
└── scripts/          # Build and utility scripts
```

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
# Start development server
pnpm start

# Run on Android
pnpm android

# Run on iOS
pnpm ios

# Run on web
pnpm web
```

### Linting

```bash
pnpm lint
```

## App Identity

- **Name**: SYPAU
- **Bundle ID**: `com.mohaned.sypau` (iOS/Android)
- **Primary Color**: `#34F6D3` (Teal/Cyan)
- **Background Color**: `#05060A` (Dark)
- **UI Style**: Dark mode

## Permissions

The app requests the following permissions:
- **Location**: Precise and coarse location access (including background)
- **Notifications**: Permission to send notifications
- **Foreground Service**: For continuous location tracking

## Database

Uses Expo SQLite for local data persistence:
- Stores Fold geometry and metadata
- Stores alarm profile configurations
- Manages location history and events

## Building

The project is configured for native builds on iOS and Android, with web support through Expo web.

## Development Notes

- React Compiler is enabled for optimizations
- Typed routes are enabled for type-safe navigation
- New Architecture is enabled for React Native
