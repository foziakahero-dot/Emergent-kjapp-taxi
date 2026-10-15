import axios from 'axios';

const env = (import.meta as any).env || {};
const configuredBase = String(env.VITE_API_BASE || '').trim().replace(/\/$/, '');
if (env.VITE_APP_ENV === 'qa' && configuredBase !== '/api') {
  throw new Error('QA Fleet requires the same-origin QA API proxy');
}
const productionBackend = 'https://api.kjappapp.no/api';
const host = window.location.hostname;
const isLegacyProductionFleetHost = host === 'fleet.kjappapp.no';
const isSnarFleetHost = host === 'fleet.snarapp.no';
const isVercelPreviewHost = host.endsWith('.vercel.app');

// SNAR Fleet on Netlify uses the same-origin /api proxy from public/_redirects.
// Legacy fleet.kjappapp.no keeps its already-proven direct production API path.
// Preview deployments never proxy into production unless VITE_API_BASE is explicitly configured.
export const API_BASE = configuredBase || (
  isSnarFleetHost
    ? `${window.location.origin}/api`
    : isLegacyProductionFleetHost
      ? productionBackend
      : isVercelPreviewHost
        ? '/__preview_api_disabled__'
        : `${window.location.origin}/api`
);
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
  documents_verified?: boolean;
  missing_document_types?: string[];
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
  fleet_active?: boolean;
  last_lat?: number;
  last_lng?: number;
  last_heading?: number;
  last_location_at?: string;
  today_income?: number;
  today_trips?: number;
  identity_verification_status?: string;
  vehicle_access_mode?: 'assigned' | 'selected' | 'all';
  allowed_vehicle_ids?: string[];
};

export type FleetLiveDriver = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  approved?: boolean;
  online?: boolean;
  gps_fresh?: boolean;
  operational_status?: 'offline' | 'gps_stale' | 'available' | 'driver_on_way' | 'at_pickup' | 'in_trip' | string;
  lat?: number;
  lng?: number;
  heading?: number;
  last_location_at?: string;
  rating?: number;
  active_trip_id?: string;
  identity_verification_status?: string;
};

export type FleetLiveTrip = {
  trip_id: string;
  driver_id?: string;
  status: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  price?: number;
  created_at?: string;
};

export type FleetLive = {
  drivers: FleetLiveDriver[];
  trips: FleetLiveTrip[];
  as_of: string;
};

export type FleetVehicle = {
  assigned_driver_id?: string | null;
  id: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  active?: boolean;
  driver_id?: string;
  driver_name?: string;
  approved?: boolean;
  fleet_active?: boolean | null;
  selected_for_shift?: boolean;
  online?: boolean;
  gps_fresh?: boolean;
  last_location_at?: string;
  identity_verification_status?: string;
  document_compliance?: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'REJECTED' | 'MISSING';
  document_statuses?: Record<string, 'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'REJECTED'>;
  missing_document_types?: string[];
};

export type FleetDocument = {
  id: string;
  filename?: string;
  content_type?: string;
  size?: number;
  scope?: string;
  doc_type?: string;
  created_at?: string;
  storage_path?: string;
  owner_type?: 'driver' | 'fleet' | 'vehicle';
  owner_id?: string;
  owner_name?: string;
  review_status?: string;
  expiry?: string;
  compliance: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'REJECTED';
};

export type FleetDocuments = {
  documents: FleetDocument[];
  summary: Record<'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'REJECTED', number>;
};

export type FleetDriverDetail = FleetDriver & {
  missing_document_types?: string[];
  documents_verified?: boolean;
  trips_completed?: number;
  active_trip?: {
    trip_id?: string;
    status?: string;
    pickup_address?: string;
    dropoff_address?: string;
  } | null;
  documents?: Array<{
    id: string;
    filename?: string;
    doc_type?: string;
    review_status?: string;
    expiry?: string;
    compliance?: string;
  }>;
};

export type FleetTrip = {
  trip_id: string;
  created_at?: string;
  status?: string;
  payment_status?: string;
  price?: number;
  pickup_address?: string;
  dropoff_address?: string;
  driver_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  vehicle_type?: string;
  receipt_id?: string;
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
  arrival_date?: string;
  created?: string;
  currency?: string;
  source?: string;
};

export type DriverInvite = {
  invite_url?: string;
  email_status?: 'sent' | 'failed' | 'not_configured' | 'not_requested';
  vehicle_access_mode?: 'assigned' | 'all';
  id?: string;
  token: string;
  vehicle_id?: string;
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
  vehicle_access_mode?: 'assigned' | 'all';
  vehicle_id?: string;
  car?: string;
  plate?: string;
  vehicle_type?: string;
  fleet_name?: string;
  fleet_org_number?: string;
  expires_at?: string;
};

export const api = {
  stripeStatus: () => http.get('/fleet/stripe/status').then((r) => r.data),
  stripeOnboarding: () => http.post('/fleet/stripe/onboarding').then((r) => r.data),
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
  driverDetail: (id: string): Promise<FleetDriverDetail> => http.get(`/fleet/drivers/${id}`).then((r) => r.data),
  live: (): Promise<FleetLive> => http.get('/fleet/live').then((r) => r.data),
  vehicles: (): Promise<{ vehicles: FleetVehicle[] }> => http.get('/fleet/vehicles').then((r) => r.data),
  createVehicle: (body: { car: string; plate: string; vehicle_type: string }): Promise<FleetVehicle> =>
    http.post('/fleet/vehicles', body).then((r) => r.data),
  updateVehicle: (id: string, body: { car?: string; plate?: string; vehicle_type?: string; active?: boolean }): Promise<FleetVehicle> =>
    http.patch(`/fleet/vehicles/${id}`, body).then((r) => r.data),
  assignVehicleDriver: (id: string, driver_id?: string | null): Promise<FleetVehicle> =>
    http.post(`/fleet/vehicles/${id}/assign-driver`, { driver_id: driver_id || null }).then((r) => r.data),
  uploadVehicleDocument: (id: string, file: File, doc_type: string, expiry?: string): Promise<FleetDocument> => {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', doc_type);
    if (expiry) form.append('expiry', expiry);
    return http.post(`/fleet/vehicles/${id}/documents`, form).then((r) => r.data);
  },
  setDriverActive: (id: string, active: boolean) =>
    http.post(`/fleet/drivers/${id}/set-active`, { active }).then((r) => r.data),
  documents: (): Promise<FleetDocuments> => http.get('/fleet/documents').then((r) => r.data),
  downloadFile: (storagePath: string) => {
    const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
    return http.get(`/files/${encoded}`, { responseType: 'blob' }).then((r) => r.data as Blob);
  },
  trips: (days = 90): Promise<{ trips: FleetTrip[] }> => http.get('/fleet/trips', { params: { days } }).then((r) => r.data),
  payouts: (): Promise<{ payouts: FleetPayout[]; source?: string; connected?: boolean; payout_schedule?: string; temporarily_unavailable?: boolean }> =>
    http.get('/fleet/payouts').then((r) => r.data),
  invites: (): Promise<{ invites: DriverInvite[] }> => http.get('/fleet/driver-invites').then((r) => r.data),
  setVehicleAccess: (id: string, mode: 'assigned' | 'selected' | 'all', vehicle_ids: string[]) =>
    http.put(`/fleet/drivers/${id}/vehicle-access`, { mode, vehicle_ids }).then((r) => r.data),
  resendInvite: (token: string) => http.post(`/fleet/driver-invites/${token}/resend`).then((r) => r.data),
  createInvite: (body: { vehicle_id: string; email?: string; note?: string; vehicle_access_mode?: 'assigned' | 'all' }) =>
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
  }) => http.post('/driver-invites/accept', body).then((r) => r.data),
  uploadDriverDoc: (file: File, inviteToken: string, docType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('invite_token', inviteToken);
    form.append('doc_type', docType);
    return http.post('/upload/driver-doc', form).then((r) => r.data);
  },
};

