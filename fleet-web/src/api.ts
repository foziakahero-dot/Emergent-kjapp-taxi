import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');
const productionBackend = 'https://github-app-builder-28.emergent.host/api';
const isProductionFleetHost = window.location.hostname === 'fleet.kjappapp.no';

export const API_BASE = configuredBase || (isProductionFleetHost ? productionBackend : window.location.origin + '/api');
export const TOKEN_KEY = 'kjapp_fleet_token';

export const http = axios.create({ baseURL: API_BASE, timeout: 30000 });

http.interceptors.request.use((cfg) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

http.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) onUnauthorized();
    return Promise.reject(e);
  },
);

export const apiError = (e: any) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  return e?.message || 'Noe gikk galt';
};

export type FleetMe = {
  id: string;
  name: string;
  org_number?: string;
  owner_user_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  bank_account?: string;
  commission_rate?: number;
  created_at?: string;
  status?: string;
  active?: boolean;
};

export type FleetOverview = {
  drivers_total: number;
  drivers_online: number;
  today: { gross: number; trips: number; net: number };
  week: { gross: number; trips: number; net: number };
  commission_pct: number;
};

export type FleetDriver = {
  id: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  rating?: number;
  online?: boolean;
  approved?: boolean;
  last_lat?: number;
  last_lng?: number;
  last_heading?: number;
  last_location_at?: string;
  today_income?: number;
  today_trips?: number;
};

export type FleetPayout = {
  id?: string;
  period_start?: string;
  period_end?: string;
  gross?: number;
  commission?: number;
  commission_amount?: number;
  net?: number;
  amount?: number;
  status?: string;
  paid_at?: string;
};

export type DriverInvite = {
  id?: string;
  token: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  email?: string;
  email_sent?: boolean;
  used?: boolean;
  created_at?: string;
  expires_at?: string;
};

export const api = {
  login: (email: string, password: string) =>
    http.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
  forgotPassword: (email: string) => http.post('/auth/forgot-password', { email }).then((r) => r.data),
  checkResetToken: (token: string) => http.get(`/auth/reset-password/${token}`).then((r) => r.data),
  resetPassword: (token: string, new_password: string) =>
    http.post('/auth/reset-password', { token, new_password }).then((r) => r.data),

  fleetMe: (): Promise<FleetMe> => http.get('/fleet/me').then((r) => r.data),
  overview: (): Promise<FleetOverview> => http.get('/fleet/overview').then((r) => r.data),
  drivers: (): Promise<{ drivers: FleetDriver[] }> => http.get('/fleet/drivers').then((r) => r.data),
  payouts: (): Promise<{ payouts: FleetPayout[] }> => http.get('/fleet/payouts').then((r) => r.data),
  invites: (): Promise<{ invites: DriverInvite[] }> => http.get('/fleet/driver-invites').then((r) => r.data),
  createInvite: (body: { car: string; plate: string; vehicle_type: string; email?: string; note?: string }) =>
    http.post('/fleet/driver-invites', body).then((r) => r.data),
  exportMonthly: (year: number, month: number) =>
    http.get('/fleet/export/monthly', { params: { year, month }, responseType: 'arraybuffer' }).then((r) => r.data as ArrayBuffer),
};
