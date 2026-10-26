import { validPosition } from './carAvailability';

export type LocationIssue = 'permission' | 'services' | 'timeout' | 'unavailable';
type LocationApi = {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getForegroundPermissionsAsync(): Promise<{ status: string }>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options: { accuracy: number }): Promise<{ coords: { latitude: number; longitude: number } }>;
  Accuracy: { High: number };
};
export const locationIssueText: Record<LocationIssue, string> = {
  permission: 'Posisjonstilgang mangler. Velg hentested manuelt, eller gi tilgang til posisjon.',
  services: 'Posisjonstjenester er slått av. Slå på GPS, eller velg hentested manuelt.',
  timeout: 'Det tok for lang tid å finne posisjonen. Prøv igjen, eller velg hentested manuelt.',
  unavailable: 'Kunne ikke finne posisjonen. Prøv igjen, eller velg hentested manuelt.',
};

/** A slow GPS lookup must never block manual pickup or overwrite a later choice. */
export async function readPickupLocation(api: LocationApi, ask: boolean, timeoutMs = 10_000): Promise<{
  point: { lat: number; lng: number } | null; issue: LocationIssue | null;
}> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await (ask ? api.requestForegroundPermissionsAsync() : api.getForegroundPermissionsAsync());
    if (permission.status !== 'granted') return { point: null, issue: 'permission' };
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
