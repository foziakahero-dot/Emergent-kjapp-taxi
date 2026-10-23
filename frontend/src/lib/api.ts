import axios from 'axios';
import { storage } from '@/src/utils/storage';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.kjappapp.no').replace(/\/$/, '');
export const TOKEN_KEY = 'kjapp_token';

export const tripDriverPhotoSource = async (tripId: string) => {
  const token = await storage.getItem(TOKEN_KEY);
  return {
    uri: `${BACKEND}/api/trips/${encodeURIComponent(tripId)}/driver-photo`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  } as any;
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
  googleWebConfig: () => api.get('/auth/google/config').then((r) => r.data),
  googleWebCode: (code: string, code_verifier: string, redirect_uri: string) =>
    api.post('/auth/google/code', { code, code_verifier, redirect_uri }).then((r) => r.data),
  nativeConfig: () => api.get('/auth/native/config', { params: { client: 'customer' } }).then((r) => r.data),
  linkGoogle: (identity_token: string) => api.post('/auth/google/link', { identity_token, client: 'customer' }).then(r => r.data),
  nativeSignIn: (provider: 'google' | 'apple', identity_token: string, device_id?: string) =>
    api.post(`/auth/${provider}/native`, { identity_token, client: 'customer', device_id }).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  login: (data: any) => api.post('/auth/login', data).then((r) => r.data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email, client: 'customer' }).then((r) => r.data),
  checkResetToken: (token: string) => api.get(`/auth/reset-password/${token}`).then((r) => r.data),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }).then((r) => r.data),
  acceptLegal: (legal_version = '2026-09') => api.post('/auth/accept-legal', { accepted_terms: true, legal_version }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: (token?: string) => api.post('/auth/logout', undefined, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then((r) => r.data),
  googleSession: (session_id: string) => api.post('/auth/google/session', { session_id }).then((r) => r.data),
  appleSignIn: (data: { identity_token: string; fullName?: string; email?: string | null }) =>
    api.post('/auth/apple', data).then((r) => r.data),
};

async function withReservation(request: () => Promise<any>) {
  try { return (await request()).data; }
  catch (error: any) {
    const detail = error?.response?.data?.detail;
    if (detail?.code !== 'reservation_requires_action') throw error;
    const { approveReservation } = await import('./nativeReservation');
    let approved: boolean;
    try { approved = await approveReservation(detail); }
    catch (approvalError) { await api.post(`/trips/${detail.trip_id}/cancel`).catch(() => {}); throw approvalError; }
    if (!approved) {
      await api.post(`/trips/${detail.trip_id}/cancel`).catch(() => {});
      throw new Error('Kortreservasjonen ble avbrutt. Ingen tur er bestilt.');
    }
    try { return (await api.post(`/trips/${detail.trip_id}/authorization/confirm`)).data; }
    catch (confirmationError) {
      const trip = (await api.get(`/trips/${detail.trip_id}`)).data;
      if (trip.payment_status === 'reserved' && trip.status !== 'payment_authorizing') return trip;
      throw confirmationError;
    }
  }
}

export const tripsApi = {
  estimate: (data: any) => api.post('/trips/estimate', data).then((r) => r.data),
  request: (data: any) => withReservation(() => api.post('/trips/request', data)),
  authorize: (id: string) => withReservation(() => api.post(`/trips/${id}/authorization/retry`)),
  retryPayment: (id: string) => api.post(`/trips/${id}/payment/retry`).then(r => r.data),
  active: () => api.get('/trips/active').then((r) => r.data),
  pickupPreference: (id: string, waiting_inside: boolean) => api.patch(`/trips/${id}/pickup-preference`, { waiting_inside }).then(r => r.data),
  get: (id: string) => api.get(`/trips/${id}`).then((r) => r.data),
  complete: (id: string) => api.post(`/trips/${id}/complete`).then((r) => r.data),
  cancelPreview: (id: string) => api.get(`/trips/${id}/cancel-preview`).then((r) => r.data),
  cancel: (id: string) => api.post(`/trips/${id}/cancel`).then((r) => r.data),
  changeDestination: (id: string, data: any) => api.patch(`/trips/${id}/destination`, data).then((r) => r.data),
  rate: (id: string, data: any) => api.post(`/trips/${id}/rate`, data).then((r) => r.data),
  list: () => api.get('/trips').then((r) => r.data),
};

export const carsApi = {
  nearby: (lat: number, lng: number, vehicle_type?: string, special_needs: string[] = []) =>
    api.post('/cars/nearby', { lat, lng, vehicle_type, special_needs }).then((r) => r.data),
};

export const placesApi = {
  list: (featuredOnly = false) =>
    api.get('/places', { params: { featured_only: featuredOnly } }).then((r) => r.data),
  search: (q: string) => api.get('/places/search', { params: { q } }).then((r) => r.data),
  reverse: (lat: number, lng: number) =>
    api.get('/places/reverse', { params: { lat, lng } }).then((r) => r.data),
};

export const paymentApi = {
  nativeConfig: () => api.get('/payments/native/config').then((r) => r.data),
  nativeIntent: (trip_id: string) => api.post('/payments/native/intent', { trip_id }).then((r) => r.data),
  nativeStatus: (id: string) => api.get(`/payments/native/intent/${id}`).then((r) => r.data),
  list: () => api.get('/payment-methods').then((r) => r.data),
  remove: (id: string) => api.delete(`/payment-methods/${id}`).then((r) => r.data),
  cardSetup: (origin_url: string) => api.post('/payments/card/setup', { origin_url }).then((r) => r.data),
  cardSetupStatus: (session_id: string) => api.get(`/payments/card/setup/${session_id}`).then((r) => r.data),
  checkout: (trip_id: string, origin_url: string) =>
    api.post('/payments/checkout', { trip_id, origin_url }).then((r) => r.data),
  checkoutStatus: (session_id: string) => api.get(`/payments/status/${session_id}`).then((r) => r.data),
  vippsConfig: () => api.get('/payments/vipps/config').then((r) => r.data),
};

export const promoApi = {
  wallet: () => api.get('/promo/wallet').then((r) => r.data),
  redeem: (code: string) => api.post('/promo/redeem', { code }).then((r) => r.data),
};

export const aiApi = {
  chat: (message: string, session_id?: string) =>
    api.post('/ai/chat', { message, session_id }).then((r) => r.data),
  transcribe: (audio_base64: string, mime_type = 'audio/m4a', language = 'no') =>
    api.post('/ai/transcribe', { audio_base64, mime_type, language }).then((r) => r.data),
};

export const messagesApi = {
  list: (tripId: string) => api.get(`/trips/${tripId}/messages`).then((r) => r.data),
  send: (tripId: string, text: string) => api.post(`/trips/${tripId}/messages`, { text }).then((r) => r.data),
  translate: (text: string, target_lang: string): Promise<{ translation: string }> =>
    api.post('/ai/translate', { text, target_lang }).then((r) => r.data),
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



export const customerProfileApi = {
  uploadPhoto: (form: FormData, progress: (percent: number) => void) => api.post('/me/profile-photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: event => { if (event.total) progress(Math.min(99, Math.round(event.loaded / event.total * 100))); },
  }).then(r => { progress(100); return r.data; }),
  deletePhoto: () => api.delete('/me/profile-photo').then(r => r.data),
  photoSource: async (version: string) => {
    const token = await storage.getItem(TOKEN_KEY);
    return { uri: `${BACKEND}/api/me/profile-photo?v=${encodeURIComponent(version)}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
  },
};
