import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');
const productionBackend = 'https://github-app-builder-28.emergent.host/api';
const host = window.location.hostname;
const isProductionFleetHost = host === 'fleet.kjappapp.no';
const isVercelPreviewHost = host.endsWith('.vercel.app');

// Never proxy a preview deployment into production. Configure VITE_API_BASE to a staging API when needed.
export const API_BASE = configuredBase || (isProductionFleetHost ? productionBackend : isVercelPreviewHost ? '/__preview_api_disabled__' : window.location.origin + '/api');
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
  documents?: Record<string, any>;
};

export type FleetOverview = {
  drivers_total: number;
  drivers_online: number;
  today: { gross: number; trips: number; net: number };
  week: { gross: number; trips: number; net: number };
  commission_pct: number;
};

export type FleetLiveDriver = {
  id: string;
  name?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  online?: boolean;
  approved?: boolean;
  last_lat?: number;
  last_lng?: number;
  last_heading?: number;
  last_location_at?: string;
  operational_status?: 'offline'|'gps_stale'|'available'|'to_pickup'|'at_pickup'|'on_trip';
  today_trips?: number;
  today_income?: number;
  selfie_verification_status?: string;
  active_trip?: null | {
    trip_id?: string;
    status?: string;
    pickup_address?: string;
    dropoff_address?: string;
  };
};

export type FleetVehicle = {
  id: string;
  plate?: string | null;
  car?: string;
  vehicle_type?: string;
  drivers: Array<{ id: string; name?: string; online?: boolean }>;
  online?: boolean;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
  approved?: boolean;
};

export type FleetSelfieVerification = {
  driver_id: string;
  driver_name?: string;
  approved?: boolean;
  status: string;
  submitted_at?: string;
  verified_at?: string;
  review_note?: string;
};

export type FleetDocumentsResponse = {
  fleet_application_status?: string;
  fleet_documents: Array<{ type: string; status: string; filename?: string; path?: string }>;
  drivers: Array<{
    driver_id: string;
    driver_name?: string;
    approved?: boolean;
    documents: Record<string, { present: boolean; path?: string }>;
    selfie_verification_status?: string;
    selfie_verification_submitted_at?: string;
    selfie_verification_verified_at?: string;
  }>;
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
  drivers_license_path?: string;
  taxi_license_path?: string;
  profile_photo_path?: string;
  selfie_verification_path?: string;
  selfie_verified_at?: string;
  documents_uploaded_at?: string;
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

export type PublicDriverInvite = {
  car?: string;
  plate?: string;
  vehicle_type?: string;
  fleet_name?: string;
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
  live: (): Promise<{ generated_at: string; drivers: FleetLiveDriver[] }> => http.get('/fleet/live').then((r) => r.data),
  vehicles: (): Promise<{ vehicles: FleetVehicle[] }> => http.get('/fleet/vehicles').then((r) => r.data),
  liveTrips: (): Promise<{ trips: any[] }> => http.get('/fleet/live-trips').then((r) => r.data),
  fleetDocuments: (): Promise<FleetDocumentsResponse> => http.get('/fleet/documents').then((r) => r.data),
  selfieVerifications: (): Promise<{ verifications: FleetSelfieVerification[] }> => http.get('/fleet/selfie-verifications').then((r) => r.data),
  payouts: (): Promise<{ payouts: FleetPayout[] }> => http.get('/fleet/payouts').then((r) => r.data),
  invites: (): Promise<{ invites: DriverInvite[] }> => http.get('/fleet/driver-invites').then((r) => r.data),
  createInvite: (body: { car: string; plate: string; vehicle_type: string; email?: string; note?: string }) =>
    http.post('/fleet/driver-invites', body).then((r) => r.data),
  exportMonthly: (year: number, month: number) =>
    http.get('/fleet/export/monthly', { params: { year, month }, responseType: 'arraybuffer' }).then((r) => r.data as ArrayBuffer),

  publicDriverInvite: (token: string): Promise<PublicDriverInvite> =>
    http.get(`/driver-invites/${token}`).then((r) => r.data),
  acceptDriverInvite: (body: {
    token: string;
    fullName: string;
    email: string;
    phone: string;
    password: string;
    accepted_terms: boolean;
    legal_version: string;
    drivers_license_path: string;
    taxi_license_path: string;
    profile_photo_path: string;
    selfie_verification_path?: string;
  }) => http.post('/driver-invites/accept', body).then((r) => r.data),
  uploadDriverDoc: (file: File, inviteToken: string, docType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('invite_token', inviteToken);
    form.append('doc_type', docType);
    return http.post('/upload/driver-doc', form).then((r) => r.data);
  },
};
