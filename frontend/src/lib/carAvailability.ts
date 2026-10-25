export type LiveCar = { id: string; lat: number; lng: number; [key: string]: any };
export type Availability = {
  cars: LiveCar[]; phase: 'loading' | 'available' | 'waiting' | 'exhausted';
  issue: 'empty' | 'offline' | null; attempt: number; nextAt: number | null;
};
export const SEARCH_INTERVAL_MS = 30_000;
export const SEARCH_ATTEMPTS = 3;
export const LIVE_REFRESH_MS = 2_000;
export function validPosition(p: any): boolean {
  return typeof p?.lat === 'number' && typeof p?.lng === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
type Clock = { now(): number; set(fn: () => void, ms: number): any; clear(timer: any): void };
// Invoke host timers as globals. Calling stored Window timer functions as object
// methods uses the wrong receiver and can crash the web availability effect.
const clock: Clock = { now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: timer => clearTimeout(timer) };

/** One in-flight lookup, bounded empty/offline retries, and no booking/payment side effects. */
export class CarAvailabilitySearch {
  state: Availability = { cars: [], phase: 'loading', issue: null, attempt: 0, nextAt: null };
  private active = false;
  private disposed = false;
  private fetching = false;
  private timer: any;
  constructor(private load: () => Promise<any>, private changed: (state: Availability) => void,
              private continuous = false, private time: Clock = clock) {}
  private publish(patch: Partial<Availability>) {
    this.state = { ...this.state, ...patch }; this.changed(this.state);
  }
  setActive(active: boolean) {
    this.active = active; this.time.clear(this.timer);
    if (!active || this.disposed || this.fetching || this.state.phase === 'exhausted') return;
    this.schedule();
  }
  private schedule() {
    if (!this.active || this.disposed) return;
    this.time.clear(this.timer);
    const check = () => {
      if (!this.continuous && this.state.attempt >= SEARCH_ATTEMPTS && this.state.issue) {
        this.publish({ phase: 'exhausted', nextAt: null });
      } else { void this.lookup(); }
    };
    const delay = Math.max(0, (this.state.nextAt || this.time.now()) - this.time.now());
    if (delay === 0) check();
    else this.timer = this.time.set(check, delay);
  }
  private async lookup() {
    if (this.fetching || !this.active || this.disposed) return;
    this.fetching = true;
    this.publish({ phase: 'loading', nextAt: null });
    let cars: LiveCar[] = [], issue: Availability['issue'] = null;
    try {
      const result = await this.load();
      if (!Array.isArray(result?.cars)) throw new Error('Invalid availability response');
      cars = result.cars.filter((car: any) => car.id && validPosition(car));
      issue = cars.length ? null : 'empty';
    } catch { issue = 'offline'; }
    this.fetching = false;
    if (this.disposed) return;
    const attempt = issue ? Math.min(SEARCH_ATTEMPTS, this.state.attempt + 1) : 0;
    this.publish({ cars, issue, attempt, phase: issue ? 'waiting' : 'available',
      nextAt: this.time.now() + (this.continuous ? LIVE_REFRESH_MS : !issue ? 8_000 : SEARCH_INTERVAL_MS) });
    this.schedule();
  }
  retry() {
    if (this.fetching || this.disposed) return;
    this.publish({ cars: [], issue: null, attempt: 0, phase: 'loading', nextAt: null });
    this.schedule();
  }
  dispose() { this.disposed = true; this.active = false; this.time.clear(this.timer); }
}

export function rideSearchProgress(trip: any, now: number) {
  const attempt = Math.max(1, Math.min(3, Number(trip?.search_attempt) || 1));
  const deadline = Date.parse(trip?.search_deadline_at || '');
  const nextAt = Date.parse(trip?.search_next_attempt_at || '');
  const seconds = Number.isFinite(nextAt) ? Math.max(0, Math.ceil((Math.min(nextAt, deadline || nextAt) - now) / 1000)) : null;
  return { attempt, seconds, label: `Forsøk ${attempt} av 3`,
    detail: seconds === null ? 'Oppdaterer søket…' : seconds > 0
      ? (attempt < 3 ? `Neste søk om ${seconds} sekunder` : `Siste søk avsluttes om ${seconds} sekunder`)
      : 'Oppdaterer søket…' };
}
