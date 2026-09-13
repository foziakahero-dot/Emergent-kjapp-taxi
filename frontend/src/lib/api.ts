import axios from 'axios';
import { storage } from '@/src/utils/storage';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');
export const TOKEN_KEY = 'kjapp_token';

export const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  login: (data: any) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  googleSession: (session_id: string) => api.post('/auth/google/session', { session_id }).then((r) => r.data),
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
  checkout: (trip_id: string, origin_url: string) =>
    api.post('/payments/checkout', { trip_id, origin_url }).then((r) => r.data),
  checkoutStatus: (session_id: string) => api.get(`/payments/status/${session_id}`).then((r) => r.data),
  vippsConfig: () => api.get('/payments/vipps/config').then((r) => r.data),
};

export const aiApi = {
  chat: (message: string, session_id?: string) =>
    api.post('/ai/chat', { message, session_id }).then((r) => r.data),
};

export const messagesApi = {
  list: (tripId: string) => api.get(`/trips/${tripId}/messages`).then((r) => r.data),
  send: (tripId: string, text: string) => api.post(`/trips/${tripId}/messages`, { text }).then((r) => r.data),
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

export const driverApi = {
  pending: () => api.get('/driver/pending').then((r) => r.data),
  accept: (trip_id: string) => api.post('/driver/accept', { trip_id }).then((r) => r.data),
  decline: (trip_id: string) => api.post('/driver/decline', { trip_id }).then((r) => r.data),
  current: () => api.get('/driver/current').then((r) => r.data),
  atPickup: (id: string) => api.post(`/driver/trip/${id}/at-pickup`).then((r) => r.data),
  start: (id: string) => api.post(`/driver/trip/${id}/start`).then((r) => r.data),
  arrive: (id: string) => api.post(`/driver/trip/${id}/arrive`).then((r) => r.data),
  noShow: (id: string) => api.post(`/driver/trip/${id}/no-show`).then((r) => r.data),
  online: (online: boolean) => api.post('/driver/online', { online }).then((r) => r.data),
  location: (lat: number, lng: number, heading = 0, speed = 0) =>
    api.post('/driver/location', { lat, lng, heading, speed }).then((r) => r.data),
  summary: () => api.get('/driver/summary/today').then((r) => r.data),
  history: () => api.get('/driver/history').then((r) => r.data),
  weekly: () => api.get('/driver/history/weekly').then((r) => r.data),
  ratings: () => api.get('/driver/ratings').then((r) => r.data),
  payouts: () => api.get('/driver/payouts').then((r) => r.data),
};
