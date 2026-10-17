import { Availability, carExpiry, LiveCar, validPosition, visibleCars } from './carAvailability';

export type MapCarData = {
  id?: string; lat: number; lng: number; heading?: number; eta_min?: number | null;
  eta_source?: string | null; eta_status?: string; online?: boolean; available?: boolean;
  photo_version?: string | null; car_icon_version?: string | null;
  name?: string; car?: string; rating?: number | null; type?: string; body_type?: string;
};
export type CarsCircle = { lat: number; lng: number; vehicle_type?: string; special_needs?: string[] };
type Socket = {
  connected: boolean; on(event: string, listener: (...args: any[]) => void): any;
  emit(event: string, data: any, ack?: (reply: any) => void): any;
  connect(): any; disconnect(): any; removeAllListeners(): any;
};
export const RADIUS_KM = 5;
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180, dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
const empty = (): Availability => ({ cars: [], expiresAt: {}, phase: 'loading', issue: null, attempt: 0, nextAt: null });

/** Owns one authenticated circle. Full snapshots replace, never merge stale cars. */
export class LiveCarsFeed {
  state = empty();
  private socket?: Socket;
  private active = false;
  private circle?: CarsCircle;
  private revision = 0;
  private lastFrame = 0;
  private lastServerTime = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(private factory: () => Socket, private changed: (state: Availability) => void,
              private now = Date.now) {}
  private publish(state: Availability) { this.state = state; this.changed(state); }
  private clear(issue: Availability['issue'] = null) {
    this.publish({ ...empty(), phase: issue ? 'waiting' : 'loading', issue });
  }
  subscribe(circle: CarsCircle) {
    if (!validPosition(circle)) { this.setActive(false); return; }
    if (JSON.stringify(circle) === JSON.stringify(this.circle)) return;
    const sameFilters = this.circle?.vehicle_type === circle.vehicle_type
      && JSON.stringify(this.circle?.special_needs || []) === JSON.stringify(circle.special_needs || []);
    this.circle = circle; this.revision++; this.lastServerTime = 0;
    // A moving customer keeps eligible cars visible while the new circle loads.
    // Cars crossing its boundary disappear locally before the server replies.
    const cars = sameFilters ? visibleCars(this.state, this.now()).filter(car => distanceKm(circle, car) <= RADIUS_KM) : [];
    this.publish({ ...this.state, cars, phase: cars.length ? 'available' : 'loading', issue: null });
    if (this.active) { this.open(); this.send(); }
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      clearTimeout(this.retryTimer);
      this.socket?.removeAllListeners(); this.socket?.disconnect(); this.socket = undefined;
      this.clear();
    } else { this.open(); }
  }
  locationUnavailable() { this.setActive(false); this.clear('location'); }
  private send() {
    const socket = this.socket, revision = this.revision;
    if (!socket?.connected || !this.circle) return;
    socket.emit('cars:subscribe', { ...this.circle, subscription_id: revision }, reply => {
      if (this.socket !== socket || revision !== this.revision || !this.active) return;
      if (reply?.error === 'rate_limited') {
        clearTimeout(this.retryTimer); this.retryTimer = setTimeout(() => this.send(), 300);
      }
    });
  }
  private open() {
    if (this.socket || !this.active || !this.circle) return;
    const socket = this.factory(); this.socket = socket;
    socket.on('connect', () => { this.lastFrame = this.now(); this.lastServerTime = 0; this.send(); });
    socket.on('disconnect', () => this.clear('offline'));
    socket.on('connect_error', () => this.clear('offline'));
    socket.on('cars:error', () => this.clear('offline'));
    socket.on('cars:snapshot', result => {
      if (!this.active || this.socket !== socket || result?.subscription_id !== this.revision) return;
      const serverTime = Date.parse(result.server_time || '');
      if (!Array.isArray(result.cars) || !Number.isFinite(serverTime) || serverTime < this.lastServerTime) return;
      this.lastFrame = this.now(); this.lastServerTime = serverTime;
      if (result.error) { this.clear('offline'); return; }
      const expiresAt: Record<string, number> = {}, cars: LiveCar[] = [];
      for (const car of result.cars) {
        if (car?.online === false || car?.available === false || typeof car?.id !== 'string' || !validPosition(car) || !this.circle || distanceKm(this.circle, car) > RADIUS_KM) continue;
        const expiry = carExpiry(car, { ...result, gps_fresh_seconds: Math.min(2, Number(result.gps_fresh_seconds)) }, this.now());
        if (expiry <= this.now() || expiresAt[car.id]) continue;
        expiresAt[car.id] = expiry; cars.push(car);
      }
      this.publish({ ...empty(), cars, expiresAt, phase: cars.length ? 'available' : 'waiting', issue: cars.length ? null : 'empty' });
    });
    socket.connect();
  }
  tick() {
    if (!this.active || !this.socket?.connected) return;
    if (this.now() - this.lastFrame > 2000) { if (this.state.issue !== 'offline') this.clear('offline'); return; }
    const cars = visibleCars(this.state, this.now());
    if (cars.length !== this.state.cars.length) this.publish({ ...this.state, cars, phase: cars.length ? 'available' : 'waiting', issue: cars.length ? null : 'empty' });
  }
  retry() {
    if (!this.active) return;
    this.revision++; this.lastServerTime = 0; this.clear();
    this.open(); if (this.socket?.connected) this.send(); else this.socket?.connect();
  }
  dispose() { this.setActive(false); }
}
