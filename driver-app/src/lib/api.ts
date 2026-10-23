import axios from 'axios';
import { storage } from '@/src/utils/storage';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.kjappapp.no').replace(/\/$/, '');
export const TOKEN_KEY = 'kjapp_token';
export const DRIVER_OFFER_SOCKET_URL = `${BACKEND.replace(/^http/, 'ws')}/api/driver/ws`;
export const KJAPP_DEFAULT_COMMISSION_PCT = 10;

export const authenticatedFileSource = async (path?: string | null) => {
  if (!path) return null;
  const token = await storage.getItem(TOKEN_KEY);
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return {
    uri: `${BACKEND}/api/files/${encoded}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  } as any;
};

export const apiError = (e: any) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return e?.message || 'Noe gikk galt';
};

export const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  nativeConfig: () => api.get('/auth/native/config', { params: { client: 'driver' } }).then((r) => r.data),
  nativeSignIn: (provider: 'google' | 'apple', identity_token: string, device_id?: string) =>
    api.post(`/auth/${provider}/native`, { identity_token, client: 'driver', device_id }).then((r) => r.data),
  login: (data: any) => api.post('/auth/login', data).then((r) => r.data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email, client: 'driver' }).then((r) => r.data),
  checkResetToken: (token: string) => api.get(`/auth/reset-password/${token}`).then((r) => r.data),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }).then((r) => r.data),
  acceptLegal: (legal_version = '2026-09') => api.post('/auth/accept-legal', { accepted_terms: true, legal_version }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: (token?: string) => api.post('/auth/logout', undefined, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then((r) => r.data),
};

export const tripsApi = {
  estimate: (data: any) => api.post('/trips/estimate', data).then((r) => r.data),
  request: (data: any) => api.post('/trips/request', data).then((r) => r.data),
  active: () => api.get('/trips/active').then((r) => r.data),
  get: (id: string) => api.get(`/trips/${id}`).then((r) => r.data),
  complete: (id: string) => api.post(`/trips/${id}/complete`).then((r) => r.data),
  cancel: (id: string) => api.post(`/trips/${id}/cancel`).then((r) => r.data),
  rate: (id: string, data: any) => api.post(`/trips/${id}/rate`, data).then((r) => r.data),
  list: () => api.get('/trips').then((r) => r.data),
};

export const carsApi = {
  nearby: (lat: number, lng: number) =>
    api.post('/cars/nearby', { lat, lng }).then((r) => r.data),
};

export const placesApi = {
  list: (featuredOnly = false) =>
    api.get('/places', { params: { featured_only: featuredOnly } }).then((r) => r.data),
  search: (q: string) => api.get('/places/search', { params: { q } }).then((r) => r.data),
  reverse: (lat: number, lng: number) =>
    api.get('/places/reverse', { params: { lat, lng } }).then((r) => r.data),
};

export const paymentApi = {
  list: () => api.get('/payment-methods').then((r) => r.data),
  add: (data: any) => api.post('/payment-methods', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/payment-methods/${id}`).then((r) => r.data),
  cardSetup: (origin_url: string) => api.post('/payments/card/setup', { origin_url }).then((r) => r.data),
  cardSetupStatus: (session_id: string) => api.get(`/payments/card/setup/${session_id}`).then((r) => r.data),
  vippsConfig: () => api.get('/payments/vipps/config').then((r) => r.data),
};

export const messagesApi = {
  list: (tripId: string) => api.get(`/trips/${tripId}/messages`).then((r) => r.data),
  send: (tripId: string, text: string) => api.post(`/trips/${tripId}/messages`, { text }).then((r) => r.data),
  translate: (text: string, target_lang: string): Promise<{ translation: string }> =>
    api.post('/ai/translate', { text, target_lang }).then((r) => r.data),
};

export const aiApi = {
  transcribe: (audio_base64: string, mime_type: string, language = 'no'): Promise<{ text: string }> =>
    api.post('/ai/transcribe', { audio_base64, mime_type, language }).then((r) => r.data),
};

export const safetyApi = {
  log: (tripId: string, data: { kind: 'emergency' | 'report' | 'share'; note?: string; lat?: number; lng?: number }) =>
    api.post(`/trips/${tripId}/safety`, data).then((r) => r.data),
  shareLink: (tripId: string) => api.post(`/trips/${tripId}/share-link`).then((r) => r.data),
};

export const gdprApi = {
  export: () => api.get('/gdpr/export').then((r) => r.data),
  delete: () => api.delete('/gdpr/delete').then((r) => r.data),
};

export const mePlacesApi = {
  list: () => api.get('/me/places').then((r) => r.data),
  add: (data: any) => api.post('/me/places', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/me/places/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/me/places/${id}`).then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (data: any) => api.patch('/settings', data).then((r) => r.data),
};

export const summaryApi = {
  today: () => api.get('/summary/today').then((r) => r.data),
};

const safeNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? n : fallback;
};

const normalizePayouts = (data: any = {}) => ({
  ...data,
  commission_pct: safeNumber(data?.commission_pct, KJAPP_DEFAULT_COMMISSION_PCT),
  earned_gross_7d: safeNumber(data?.earned_gross_7d ?? data?.pending_gross),
  earned_net_7d: safeNumber(data?.earned_net_7d ?? data?.pending_trip_net ?? data?.pending_net),
  paid_trips_7d: safeNumber(data?.paid_trips_7d ?? data?.pending_trips),
  pending_gross: safeNumber(data?.pending_gross),
  pending_net: safeNumber(data?.pending_net),
  pending_trips: safeNumber(data?.pending_trips),
  next_payout_date: data?.next_payout_date || data?.next_payout || null,
  settlement_recipient: data?.settlement_recipient || 'fleet',
  stripe_connect_ready: data?.stripe_connect_ready === true,
  payout_schedule: data?.payout_schedule || 'stripe_default',
  history: Array.isArray(data?.history) ? data.history : [],
});

export const driverApi = {
  pending: () => api.get('/driver/pending').then((r) => r.data),
  accept: (trip_id: string) => api.post('/driver/accept', { trip_id }).then((r) => r.data),
  decline: (trip_id: string) => api.post('/driver/decline', { trip_id }).then((r) => r.data),
  current: () => api.get('/driver/current').then((r) => r.data),
  atPickup: (id: string) => api.post(`/driver/trip/${id}/at-pickup`).then((r) => r.data),
  start: (id: string) => api.post(`/driver/trip/${id}/start`).then((r) => r.data),
  cancel: (id: string) => api.post(`/driver/trip/${id}/cancel`).then((r) => r.data),
  arrive: (id: string) => api.post(`/driver/trip/${id}/arrive`).then((r) => r.data),
  noShow: (id: string) => api.post(`/driver/trip/${id}/no-show`).then((r) => r.data),
  online: (online: boolean) => api.post('/driver/online', { online }).then((r) => r.data),
  location: (lat: number, lng: number, heading = 0, speed = 0, recorded_at?: string) =>
    api.post('/driver/location', { lat, lng, heading, speed, recorded_at }).then((r) => r.data),
  summary: () => api.get('/driver/summary/today').then((r) => r.data),
  history: () => api.get('/driver/history').then((r) => r.data),
  weekly: () => api.get('/driver/history/weekly').then((r) => r.data),
  ratings: () => api.get('/driver/ratings').then((r) => r.data),
  payouts: () => api.get('/driver/payouts')
    .then((r) => normalizePayouts(r.data)),
  vehicles: () => api.get('/driver/vehicles').then((r) => r.data),
  selectVehicle: (vehicle_id: string) => api.post(`/driver/vehicles/${vehicle_id}/select`).then((r) => r.data),
  updateProfilePhoto: (uri: string) => {
    const form = new FormData();
    form.append('file', {
      uri,
      name: `kjapp-profile-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    return api.post('/driver/profile-photo', form).then((r) => r.data);
  },
  identityVerification: () => api.get('/driver/identity-verification').then((r) => r.data),
  submitIdentitySelfie: (uri: string) => {
    const form = new FormData();
    form.append('file', {
      uri,
      name: `kjapp-selfie-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    return api.post('/driver/identity-verification/selfie', form).then((r) => r.data);
  },
};

