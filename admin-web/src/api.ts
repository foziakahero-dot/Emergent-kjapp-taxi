import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');
const productionBackend = 'https://api.kjappapp.no/api';
const host = window.location.hostname;
const isProductionAdminHost = host === 'admin.kjappapp.no';
const isVercelPreviewHost = host.endsWith('.vercel.app');

// Production uses the production API directly. Vercel previews are intentionally isolated:
// they can only talk to an API when VITE_API_BASE is explicitly configured (e.g. staging).
export const API_BASE = configuredBase || (isProductionAdminHost ? productionBackend : isVercelPreviewHost ? '/__preview_api_disabled__' : window.location.origin + '/api');
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
  me: () => http.get('/auth/me').then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  twofaStatus: () => http.get('/auth/2fa/status').then((r) => r.data),
  twofaSetup: () => http.post('/auth/2fa/setup').then((r) => r.data),
  twofaEnable: (code: string) => http.post('/auth/2fa/enable', { code }).then((r) => r.data),
  twofaDisable: (password: string, code: string) => http.post('/auth/2fa/disable', { password, code }).then((r) => r.data),

  overview: () => http.get('/admin/overview').then((r) => r.data),
  betaHealth: (days = 7) => http.get('/admin/beta-health', { params: { days } }).then((r) => r.data),
  clientErrors: (page_size = 8) => http.get('/admin/client-errors', { params: { page: 1, page_size } }).then((r) => r.data),
  live: () => http.get('/admin/live').then((r) => r.data),
  finance: (days = 30) => http.get('/admin/finance', { params: { days } }).then((r) => r.data),
  receipts: (params: any = {}) => http.get('/admin/receipts', { params }).then((r) => r.data),
  receipt: (id: string) => http.get(`/admin/receipts/${encodeURIComponent(id)}`).then((r) => r.data),
  backfillReceipts: (limit = 500) => http.post('/admin/receipts/backfill', null, { params: { limit } }).then((r) => r.data),

  list: (path: string, params: any) => http.get(path, { params }).then((r) => r.data),
  timeline: (id: string) => http.get(`/admin/trips/${id}/timeline`).then((r) => r.data),
  setDriverStatus: (id: string, approved: boolean) =>
    http.post(`/admin/drivers/${id}/set-status`, { approved }).then((r) => r.data),
  setDriverCapabilities: (id: string, capabilities: string[]) =>
    http.patch(`/admin/drivers/${id}/capabilities`, { capabilities }).then((r) => r.data),
  identityVerifications: (status = 'pending_review', page = 1, page_size = 50) =>
    http.get('/admin/identity-verifications', { params: { status, page, page_size } }).then((r) => r.data),
  reviewIdentityVerification: (id: string, status: 'verified' | 'retry_required', reason?: string) =>
    http.post(`/admin/identity-verifications/${id}/review`, { status, reason: reason || null }).then((r) => r.data),
  identityRetention: () =>
    http.get('/admin/identity-verifications/retention').then((r) => r.data),
  purgeExpiredIdentitySelfies: (dry_run = true, limit = 100) =>
    http.post('/admin/identity-verifications/purge-expired', { dry_run, limit }).then((r) => r.data),
  requestIdentityRecheck: (driver_id: string, reason: string) =>
    http.post(`/admin/drivers/${driver_id}/identity-recheck`, { reason }).then((r) => r.data),
  secureFile: (path: string) =>
    http.get(`/files/${encodeStoragePath(path)}`, { responseType: 'blob' }).then((r) => r.data as Blob),
  interveneTrip: (id: string, body: any) =>
    http.post(`/admin/trips/${id}/intervene`, body).then((r) => r.data),
  setUserStatus: (id: string, disabled: boolean, reason = '') =>
    http.post(`/admin/users/${id}/set-status`, { disabled, reason }).then((r) => r.data),
  reviewDoc: (id: string, body: any) =>
    http.post(`/admin/documents/${id}/review`, body).then((r) => r.data),
  refund: (body: any) => http.post('/admin/refunds', body).then((r) => r.data),
  updateTicket: (id: string, body: any) =>
    http.patch(`/admin/support/tickets/${id}`, body).then((r) => r.data),
  patchSettings: (body: any) => http.patch('/admin/settings', body).then((r) => r.data),
  pricingTest: (body: any) => http.post('/admin/pricing/test', body).then((r) => r.data),
  pricingRouteTest: (body: any) => http.post('/admin/pricing/test-route', body).then((r) => r.data),
  pricingHistory: () => http.get('/admin/pricing/history').then((r) => r.data),
  pricingRollback: (version: number) => http.post('/admin/pricing/rollback', { version }).then((r) => r.data),
  betaReadiness: () => http.get('/admin/beta-readiness').then((r) => r.data),
  search: (q: string) => http.get('/admin/search', { params: { q } }).then((r) => r.data),

  // Superadmin-only løyvehaver onboarding. A fleet_owner account is created only after approval.
  fleetApplications: (status = 'pending') =>
    http.get('/superadmin/fleet-applications', { params: status ? { status } : {} }).then((r) => r.data),
  fleetApplication: (id: string) =>
    http.get(`/superadmin/fleet-applications/${id}`).then((r) => r.data),
  approveFleetApplication: (id: string, review_notes = '') =>
    http.post(`/superadmin/fleet-applications/${id}/approve`, {
      review_notes,
      commission_rate: 0.10,
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
