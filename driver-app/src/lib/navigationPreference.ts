export type NavigationApp = 'google' | 'waze' | 'apple';

export function navigationStorageKey(userId: string) {
  return `driver_navigation_app_v2:${userId}`;
}

export function isNavigationApp(value: unknown): value is NavigationApp {
  return value === 'google' || value === 'waze' || value === 'apple';
}
