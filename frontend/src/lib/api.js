import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 30000,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("kjapp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  googleSession: (session_id) => api.post("/auth/google/session", { session_id }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
};

export const adminApi = {
  overview: () => api.get("/admin/overview").then((r) => r.data),
  users: () => api.get("/admin/users").then((r) => r.data),
  drivers: () => api.get("/admin/drivers").then((r) => r.data),
  trips: () => api.get("/admin/trips").then((r) => r.data),
  approveDriver: (id, approved = true) => api.post(`/admin/drivers/${id}/approve`, { approved }).then((r) => r.data),
  createInvite: ({ car, plate, vehicle_type = "ai-first", note = "", email = "" }) =>
    api.post("/admin/driver-invites", { car, plate, vehicle_type, note, email: email || undefined }).then((r) => r.data),
  invites: () => api.get("/admin/driver-invites").then((r) => r.data),
};

export const driverInviteApi = {
  get: (token) => api.get(`/driver-invites/${token}`).then((r) => r.data),
  accept: (data) => api.post("/driver-invites/accept", data).then((r) => r.data),
};

export const tripsApi = {
  request: (data) => api.post("/trips/request", data).then((r) => r.data),
  active: () => api.get("/trips/active").then((r) => r.data),
  get: (id) => api.get(`/trips/${id}`).then((r) => r.data),
  complete: (id) => api.post(`/trips/${id}/complete`).then((r) => r.data),
  rate: (id, data) => api.post(`/trips/${id}/rate`, data).then((r) => r.data),
  cancel: (id) => api.post(`/trips/${id}/cancel`).then((r) => r.data),
  list: () => api.get("/trips").then((r) => r.data),
  estimate: (data) => api.post("/trips/estimate", data).then((r) => r.data),
  messages: (id) => api.get(`/trips/${id}/messages`).then((r) => r.data),
  sendMessage: (id, text) => api.post(`/trips/${id}/messages`, { text }).then((r) => r.data),
};

export const carsApi = {
  nearby: (lat, lng) => api.post("/cars/nearby", { lat, lng }).then((r) => r.data),
};

export const placesApi = {
  list: (featuredOnly = false) => api.get("/places", { params: { featured_only: featuredOnly } }).then((r) => r.data),
  search: (q) => api.get("/places/search", { params: { q } }).then((r) => r.data),
};

export const paymentApi = {
  list: () => api.get("/payment-methods").then((r) => r.data),
  add: (data) => api.post("/payment-methods", data).then((r) => r.data),
  remove: (id) => api.delete(`/payment-methods/${id}`).then((r) => r.data),
  cardSetup: (origin_url) => api.post("/payments/card/setup", { origin_url }).then((r) => r.data),
  cardSetupStatus: (session_id) => api.get(`/payments/card/setup/${session_id}`).then((r) => r.data),
  vippsConfig: () => api.get("/payments/vipps/config").then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get("/settings").then((r) => r.data),
  update: (data) => api.patch("/settings", data).then((r) => r.data),
};

export const aiApi = {
  chat: (message, session_id) => api.post("/ai/chat", { message, session_id }).then((r) => r.data),
  history: (session_id) => api.get("/ai/history", { params: { session_id } }).then((r) => r.data),
};

export const summaryApi = {
  today: () => api.get("/summary/today").then((r) => r.data),
};

export const driverApi = {
  pending: () => api.get("/driver/pending").then((r) => r.data),
  accept: (trip_id) => api.post("/driver/accept", { trip_id }).then((r) => r.data),
  current: () => api.get("/driver/current").then((r) => r.data),
  start: (trip_id) => api.post(`/driver/trip/${trip_id}/start`).then((r) => r.data),
  arrive: (trip_id) => api.post(`/driver/trip/${trip_id}/arrive`).then((r) => r.data),
  cancel: (trip_id) => api.post(`/driver/trip/${trip_id}/cancel`).then((r) => r.data),
  summary: () => api.get("/driver/summary/today").then((r) => r.data),
  history: () => api.get("/driver/history").then((r) => r.data),
  weeklyHistory: () => api.get("/driver/history/weekly").then((r) => r.data),
  location: (lat, lng, heading, speed) => api.post("/driver/location", { lat, lng, heading, speed }).then((r) => r.data),
  online: (online) => api.post("/driver/online", { online }).then((r) => r.data),
};

export const pricingApi = {
  surge: () => api.get("/pricing/surge").then((r) => r.data),
};

export const paymentsApi = {
  checkout: (trip_id, origin_url) => api.post("/payments/checkout", { trip_id, origin_url }).then((r) => r.data),
  status: (session_id) => api.get(`/payments/status/${session_id}`).then((r) => r.data),
};

export const gdprApi = {
  export: () => api.get("/gdpr/export").then((r) => r.data),
  delete: () => api.delete("/gdpr/delete").then((r) => r.data),
};

export const pushApi = {
  publicKey: () => api.get("/push/vapid-public-key").then((r) => r.data),
  subscribe: (subscription) => api.post("/push/subscribe", { subscription }).then((r) => r.data),
  test: () => api.post("/push/test").then((r) => r.data),
};

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Noe gikk galt. Prøv igjen.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
