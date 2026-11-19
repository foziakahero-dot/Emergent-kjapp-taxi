import { validPosition } from './carAvailability';

export type LocationIssue = 'permission' | 'settings' | 'services' | 'timeout' | 'unavailable';
type LocationApi = {
  requestForegroundPermissionsAsync(): Promise<{ status: string; canAskAgain?: boolean }>;
  getForegroundPermissionsAsync(): Promise<{ status: string; canAskAgain?: boolean }>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options: { accuracy: number }): Promise<{ coords: { latitude: number; longitude: number } }>;
  Accuracy: { High: number };
};
export const locationIssueText: Record<LocationIssue, string> = {
  permission: 'Del posisjonen din, så kan du se ledige biler der du er.',
  settings: 'Du kan gi SNAR tilgang til posisjonen din i telefonens innstillinger.',
  services: 'Posisjon er slått av på telefonen. Slå den på, eller skriv inn hentestedet.',
  timeout: 'Det tar tid å finne deg. Prøv igjen, eller skriv inn hentestedet.',
  unavailable: 'Vi finner ikke posisjonen din. Du kan skrive inn hentestedet selv.',
};

/** A slow GPS lookup must never block manual pickup or overwrite a later choice. */
export async function readPickupLocation(api: LocationApi, ask: boolean, timeoutMs = 10_000): Promise<{
  point: { lat: number; lng: number } | null; issue: LocationIssue | null;
}> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await (ask ? api.requestForegroundPermissionsAsync() : api.getForegroundPermissionsAsync());
    if (permission.status !== 'granted') {
      return { point: null, issue: permission.canAskAgain === false ? 'settings' : 'permission' };
    }
    if (!(await api.hasServicesEnabledAsync())) return { point: null, issue: 'services' };
    const position = await Promise.race([
      api.getCurrentPositionAsync({ accuracy: api.Accuracy.High }),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (!position) return { point: null, issue: 'timeout' };
    const point = { lat: position.coords.latitude, lng: position.coords.longitude };
    return validPosition(point) ? { point, issue: null } : { point: null, issue: 'unavailable' };
  } catch { return { point: null, issue: 'unavailable' }; }
  finally { if (timer) clearTimeout(timer); }
}
