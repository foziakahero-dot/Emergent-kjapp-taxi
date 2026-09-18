import axios from 'axios';

// Same-origin `/api` works in the Emergent preview (served under /api/ops).
// For production (admin.kjappapp.no) set VITE_API_BASE to the prod API, e.g.
// https://api.kjappapp.no/api  — CORS already whitelists admin.kjappapp.no.
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || window.location.origin + '/api';

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
  formatError(e?.response?.data?.detail || e?.message || 'Noe gikk galt');

export function formatError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || 'Ugyldig verdi').join('. ');
  return 'Forespørselen kunne ikke behandles. Prøv igjen.';
}

export async function download(path: string, filename: string, params?: any) {
  const r = await http.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const post = (path: string, body: any = {}) => http.post(path, body).then(r => r.data);
export const patch = (path: string, body: any) => http.patch(path, body).then(r => r.data);

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
