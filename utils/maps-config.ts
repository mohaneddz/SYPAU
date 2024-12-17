import Constants from 'expo-constants';

import { isExpoGo } from '@/utils/environment';

/**
 * Whether it's safe to mount a native Google-provider MapView on Android.
 *
 * Expo Go bundles its own testing API key and works regardless of what's in
 * app.json, but a real native build reads android.config.googleMaps.apiKey
 * from the manifest — if that's blank, mounting MapView throws a native
 * (non-JS-catchable) Fabric commit error that blanks the whole screen. So
 * outside Expo Go, only render MapView once a real key is configured there.
 */
export function canRenderGoogleMaps(): boolean {
  if (isExpoGo) return true;
  const apiKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}
