import { isExpoGo } from '@/utils/environment';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;

/**
 * Lazily loads expo-notifications. Merely importing it triggers a module-scope
 * push-registration side effect that throws inside Expo Go (SDK 53+ dropped
 * remote push there) — so every caller must go through this instead of a
 * static top-level import, and expect `null` back when running in Expo Go.
 */
export async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!cached) cached = await import('expo-notifications');
  return cached;
}
