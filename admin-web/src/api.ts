import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');
const productionBackend = 'https://github-app-builder-28.emergent.host/api';
const isProductionAdminHost = window.location.hostname === 'admin.kjappapp.no';

// Production can call the Emergent backend directly (CORS is allowlisted there).
// Local/staging can still override VITE_API_BASE; otherwise use the same-origin /api proxy.
export const API_BASE = configuredBase || (isProductionAdminHost ? productionBackend : window.location.origin + '/api');
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
