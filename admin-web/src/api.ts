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

export const apiError = (e: any) => {
  if (e?.response?.status === 404) return 'Denne delen er ikke aktivert i produksjons-API-et ennå.';
  return e?.response?.data?.detail || e?.message || 'Noe gikk galt';
};

const encodeStoragePath = (path: string) =>
  String(path || '').split('/').map((part) => encodeURIComponent(part)).join('/');

export const api = {
  login: (email: string, password: string) =>
    http.post('/auth/login', { email, password }).then((r) => r.data),
  verify2fa: (twofa_token: string, code: string) =>
    http.post('/auth/2fa/verify-login', { twofa_token, code }).then((r) => r.data),
  twofaEnrollSetup: (twofa_token: string) =>
    http.post('/auth/2fa/enroll/setup', { twofa_token }).then((r) => r.data),
  twofaEnrollEnable: (twofa_token: string, code: string) =>
    http.post('/auth/2fa/enroll/enable', { twofa_token, code }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  twofaStatus: () => http.get('/auth/2fa/status').then((r) => r.data),
  twofaSetup: () => http.post('/auth/2fa/setup').then((r) => r.data),
  twofaEnable: (code: string) => http.post('/auth/2fa/enable', { code }).then((r) => r.data),
  twofaDisable: (password: string, code: string) => http.post('/auth/2fa/disable', { password, code }).then((r) => r.data),

  overview: () => http.get('/admin/overview').then((r) => r.data),
  live: () => http.get('/admin/live').then((r) => r.data),
  finance: (days = 30) => http.get('/admin/finance', { params: { days } }).then((r) => r.data),

  list: (path: string, params: any) => http.get(path, { params }).then((r) => r.data),
  timeline: (id: string) => http.get(`/admin/trips/${id}/timeline`).then((r) => r.data),
  setDriverStatus: (id: string, approved: boolean) =>
    http.post(`/admin/drivers/${id}/set-status`, { approved }).then((r) => r.data),
  reviewDoc: (id: string, body: any) =>
    http.post(`/admin/documents/${id}/review`, body).then((r) => r.data),
  refund: (body: any, idempotencyKey: string) =>
    http.post('/admin/refunds', body, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data),
  updateTicket: (id: string, body: any) =>
    http.patch(`/admin/support/tickets/${id}`, body).then((r) => r.data),
  patchSettings: (body: any) => http.patch('/admin/settings', body).then((r) => r.data),
  search: (q: string) => http.get('/admin/search', { params: { q } }).then((r) => r.data),

  // Superadmin-only løyvehaver onboarding. A fleet_owner account is created only after approval.
  fleetApplications: (status = 'pending') =>
    http.get('/superadmin/fleet-applications', { params: status ? { status } : {} }).then((r) => r.data),
  fleetApplication: (id: string) =>
    http.get(`/superadmin/fleet-applications/${id}`).then((r) => r.data),
  approveFleetApplication: (id: string, review_notes = '') =>
    http.post(`/superadmin/fleet-applications/${id}/approve`, {
      review_notes,
      commission_rate: 0.12,
    }).then((r) => r.data),
  rejectFleetApplication: (id: string, review_notes = '') =>
    http.post(`/superadmin/fleet-applications/${id}/reject`, { review_notes }).then((r) => r.data),
  applicationFile: (path: string) =>
    http.get(`/files/${encodeStoragePath(path)}`, { responseType: 'blob' }).then((r) => r.data as Blob),
  // Admin Control Center
  controlActionCenter: () => http.get('/admin/control/action-center').then((r) => r.data),
  controlIntegrations: () => http.get('/admin/control/integrations').then((r) => r.data),
  controlFleets: () => http.get('/admin/fleets-full').then((r) => r.data),
  createFleet: (body: any) => http.post('/admin/fleets', body).then((r) => r.data),
  fleetDetail: (id: string) => http.get(`/admin/fleets/${id}`).then((r) => r.data),
  suspendFleet: (id: string, reason = '') => http.post(`/admin/fleets/${id}/suspend`, { reason }).then((r) => r.data),
  reactivateFleet: (id: string) => http.post(`/admin/fleets/${id}/reactivate`).then((r) => r.data),
  updateFleetCommission: (id: string, commission_rate: number, reason = '') =>
    http.post(`/admin/fleets/${id}/commission`, { commission_rate, reason }).then((r) => r.data),
  inviteFleetDriver: (id: string, body: any) =>
    http.post(`/admin/control/fleets/${id}/driver-invites`, body).then((r) => r.data),
  updateFleetVehicle: (id: string, body: any) =>
    http.post(`/admin/control/fleets/${id}/vehicle`, body).then((r) => r.data),
  stripeFleets: () => http.get('/admin/control/stripe-fleets').then((r) => r.data),
  stripeConnect: (id: string) => http.post(`/admin/control/fleets/${id}/stripe-connect`).then((r) => r.data),
  stripeStatus: (id: string) => http.get(`/admin/control/fleets/${id}/stripe-status`).then((r) => r.data),
  stripePayouts: () => http.get('/admin/control/payouts').then((r) => r.data),
  communicationFleets: () => http.get('/admin/control/communication-fleets').then((r) => r.data),
  communications: () => http.get('/admin/control/communications').then((r) => r.data),
  sendCommunication: (body: any) => http.post('/admin/control/communications', body).then((r) => r.data),
  adminUsers: () => http.get('/admin/control/admin-users').then((r) => r.data),
  createAdminUser: (body: any) => http.post('/admin/control/admin-users', body).then((r) => r.data),
  updateAdminUser: (id: string, body: any) => http.patch(`/admin/control/admin-users/${id}`, body).then((r) => r.data),

};
