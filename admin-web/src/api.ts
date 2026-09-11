import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');

// Emergent preview serves admin-web under the backend and can safely use same-origin /api.
// Production is intentionally strict: admin.kjapp.no MUST be wired to the shared
// Emergent FastAPI backend explicitly through VITE_API_BASE. This prevents an
// accidental deploy from silently calling admin.kjapp.no/api or an old backend.
if (env.PROD && !configuredBase) {
  throw new Error(
    'KJAPP Admin deployment error: VITE_API_BASE is required in production and must point to the shared Emergent FastAPI /api base.',
  );
}

export const API_BASE = configuredBase || window.location.origin + '/api';
export const TOKEN_KEY = 'kjapp_admin_token';

export const http = axios.create({ baseURL: API_BASE, timeout: 20000 });

http.interceptors.request.use((cfg) => {
  const t = sessionStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

http.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) onUnauthorized();
    return Promise.reject(e);
  },
);

export const apiError = (e: any) =>
  e?.response?.data?.detail || e?.message || 'Noe gikk galt';

export const api = {
  login: (email: string, password: string) =>
    http.post('/auth/login', { email, password }).then((r) => r.data),
  verify2fa: (twofa_token: string, code: string) =>
    http.post('/auth/2fa/verify-login', { twofa_token, code }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),

  overview: () => http.get('/admin/overview').then((r) => r.data),
  live: () => http.get('/admin/live').then((r) => r.data),
  finance: (days = 30) => http.get('/admin/finance', { params: { days } }).then((r) => r.data),

  list: (path: string, params: any) => http.get(path, { params }).then((r) => r.data),
  timeline: (id: string) => http.get(`/admin/trips/${id}/timeline`).then((r) => r.data),
  setDriverStatus: (id: string, approved: boolean) =>
    http.post(`/admin/drivers/${id}/set-status`, { approved }).then((r) => r.data),
  reviewDoc: (id: string, body: any) =>
    http.post(`/admin/documents/${id}/review`, body).then((r) => r.data),
  refund: (body: any) => http.post('/admin/refunds', body).then((r) => r.data),
  updateTicket: (id: string, body: any) =>
    http.patch(`/admin/support/tickets/${id}`, body).then((r) => r.data),
  patchSettings: (body: any) => http.patch('/admin/settings', body).then((r) => r.data),
  search: (q: string) => http.get('/admin/search', { params: { q } }).then((r) => r.data),
};
