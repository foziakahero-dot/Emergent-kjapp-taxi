import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";
import { StatusBar } from "./components/UIKit";
import BottomNav from "./components/BottomNav";
import { initNativeShell, isNative, registerNativePush, pushListenForeground } from "./lib/native";

import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VoiceSignIn from "./pages/VoiceSignIn";
import Home from "./pages/Home";
import BookingFlow from "./pages/BookingFlow";
import TripReceipt from "./pages/TripReceipt";
import AIChat from "./pages/AIChat";
import Profile from "./pages/Profile";
import PaymentMethods from "./pages/PaymentMethods";
import Settings from "./pages/Settings";
import TripHistory from "./pages/TripHistory";
import HelpSupport from "./pages/HelpSupport";
import DriverHome from "./pages/DriverHome";
import DriverTrip from "./pages/DriverTrip";
import DriverSummary from "./pages/DriverSummary";
import DriverHistory from "./pages/DriverHistory";
import DriverPayouts from "./pages/DriverPayouts";
import DriverProfile from "./pages/DriverProfile";
import DriverBottomNav from "./components/DriverBottomNav";
import { Toaster } from "sonner";
import DriverLogin from "./pages/DriverLogin";
import DriverSignup from "./pages/DriverSignup";
import AdminDashboard from "./pages/AdminDashboard";
import FleetOverview from "./pages/FleetOverview";
import FleetDrivers from "./pages/FleetDrivers";
import FleetPayouts from "./pages/FleetPayouts";
import AuthCallback from "./pages/AuthCallback";
import GoogleCallback from "./pages/GoogleCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import CookieConsent from "./components/CookieConsent";
import DevNavigator from "./components/DevNavigator";
import ApplyFleet from "./pages/ApplyFleet";
import SuperadminApplications from "./pages/SuperadminApplications";
import SuperadminApplicationDetail from "./pages/SuperadminApplicationDetail";
import SuperadminPending from "./pages/SuperadminPending";
import AdminShell from "./components/AdminShell";
import AdminOverview from "./pages/AdminOverview";
import AdminFleets from "./pages/AdminFleets";
import AdminFleetDetail from "./pages/AdminFleetDetail";
import AdminAudit from "./pages/AdminAudit";
import AdminLive from "./pages/AdminLive";
import AdminDrivers from "./pages/AdminDrivers";
import AdminVehicles from "./pages/AdminVehicles";
import AdminTrips from "./pages/AdminTrips";
import AdminBonus from "./pages/AdminBonus";
import AdminFinance from "./pages/AdminFinance";
import AdminDocuments from "./pages/AdminDocuments";
import AdminSupport from "./pages/AdminSupport";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminSettings from "./pages/AdminSettings";

// APP_MODE — la deg deploye samme kodebase som 3 separate apper.
// Bestemmes ved (i prioritert rekkefølge):
//   1) Runtime hostname:  fleet.*  → "fleet",   admin.* → "admin"
//   2) Build-time env:    REACT_APP_MODE=fleet|admin
//   3) Default:           "main" (kunde + sjåfør)
// Dette gjør at ÉN deploy til Emergent kan serveres på 3 domener via CNAME:
//   kjapp.no        → main
//   fleet.kjapp.no  → fleet
//   admin.kjapp.no  → admin
function detectAppMode() {
  if (typeof window !== "undefined" && window.location) {
    const host = (window.location.hostname || "").toLowerCase();
    // 1) Real hostname ALWAYS wins — a shared ?mode= link must never hijack the real domain
    if (host.startsWith("fleet.")) return "fleet";
    if (host.startsWith("admin.")) return "admin";
    // 2) URL param / stored override (preview & testing only, on a neutral host)
    try {
      const qm = new URLSearchParams(window.location.search).get("mode");
      if (qm && ["fleet", "admin", "main"].includes(qm.toLowerCase())) {
        try { window.localStorage.setItem("kjapp_mode_override", qm.toLowerCase()); } catch { /* ignore */ }
        return qm.toLowerCase();
      }
      const stored = window.localStorage.getItem("kjapp_mode_override");
      if (stored && ["fleet", "admin", "main"].includes(stored)) return stored;
    } catch { /* ignore */ }
  }
  // 3) Build-time env
  return (process.env.REACT_APP_MODE || "main").toLowerCase();
}
const APP_MODE = detectAppMode();
const IS_FLEET_APP = APP_MODE === "fleet";
const IS_ADMIN_APP = APP_MODE === "admin";
const IS_STANDALONE = IS_FLEET_APP || IS_ADMIN_APP;

// Expose for debugging
if (typeof window !== "undefined") window.__KJAPP_MODE = APP_MODE;

function redirectAfterLogin(user) {
  if (IS_FLEET_APP) return "/fleet";
  if (IS_ADMIN_APP) return user.role === "superadmin" ? "/loyver" : "/admin";
  if (user.role === "superadmin") return "/loyver";
  if (user.role === "admin") return "/admin";
  if (user.role === "driver") return "/driver";
  if (user.role === "fleet_owner") return "/fleet";
  return "/app";
}

function Protected({ children, driverOnly = false, adminOnly = false, fleetOnly = false, superadminOnly = false }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSplash />;
  if (!user) return <Navigate to="/login" replace />;
  // Standalone portals (fleet.kjapp.no / admin.kjapp.no): only permitted roles may enter.
  // Everyone else is sent back to /login (server-side RBAC is the real enforcement).
  if (IS_FLEET_APP && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <Navigate to="/login" replace />;
  if (IS_ADMIN_APP && !["admin", "superadmin"].includes(user.role)) return <Navigate to="/login" replace />;
  // Per-route role guards. Redirect wrong roles to THEIR own landing (never a non-existent route → no loop).
  if (superadminOnly && user.role !== "superadmin") return <Navigate to={redirectAfterLogin(user)} replace />;
  if (adminOnly && !["admin", "superadmin"].includes(user.role)) return <Navigate to={redirectAfterLogin(user)} replace />;
  if (fleetOnly && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <Navigate to={redirectAfterLogin(user)} replace />;
  if (driverOnly && !["driver", "admin", "superadmin"].includes(user.role)) return <Navigate to={redirectAfterLogin(user)} replace />;
  return children;
}

function WrongPortal() {
  const { logout } = useAuth();
  const label = IS_ADMIN_APP ? "administrasjonsportalen" : "flåteportalen";
  return (
    <div className="phone-shell grain flex flex-col items-center justify-center px-8 text-center" data-testid="wrong-portal">
      <h1 className="font-display text-2xl text-white">Feil konto for {label}</h1>
      <p className="text-[#8A9198] text-sm mt-3">Denne kontoen har ikke tilgang her. Logg inn med en konto som har tilgang.</p>
      <button
        onClick={() => logout()}
        data-testid="wrong-portal-logout"
        className="mt-6 px-6 py-3 rounded-xl font-medium"
        style={{ background: "var(--accent)", color: "#0B1013" }}
      >
        Logg ut
      </button>
    </div>
  );
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSplash />;
  if (user) {
    // In a standalone portal, an authenticated session with a role that isn't permitted here must
    // NOT bounce into the portal (would loop). Show a clear wrong-account notice instead.
    if (IS_FLEET_APP && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <WrongPortal />;
    if (IS_ADMIN_APP && !["admin", "superadmin"].includes(user.role)) return <WrongPortal />;
    return <Navigate to={redirectAfterLogin(user)} replace />;
  }
  return children;
}

function LoadingSplash() {
  return (
    <div className="min-h-screen grid place-items-center bg-bg">
      <div className="orb orb-small" />
    </div>
  );
}

function Shell({ children, withNav = true, driver = false }) {
  // Toggle body class for role-based theming (customer=warm nordic, driver=HUD)
  React.useEffect(() => {
    if (driver) document.body.classList.add("driver-theme");
    else document.body.classList.remove("driver-theme");
    return () => document.body.classList.remove("driver-theme");
  }, [driver]);
  return (
    <div className="phone-shell grain">
      <div style={{ minHeight: "100dvh" }}>{children}</div>
      {withNav && (driver ? <DriverBottomNav /> : <BottomNav />)}
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Synchronous session_id detection (Emergent Google OAuth) — must run BEFORE any route guards,
  // and must read from useLocation().hash (reactive), covering all app modes (main/fleet/admin).
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  // FLEET STANDALONE APP (fleet.kjapp.no build)
  if (IS_FLEET_APP) {
    return (
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password/:token" element={<PublicOnly><ResetPassword /></PublicOnly>} />
        <Route path="/auth/google" element={<GoogleCallback />} />
        <Route path="/apply" element={<ApplyFleet />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/fleet" element={<Protected fleetOnly><Shell withNav={false}><FleetOverview /></Shell></Protected>} />
        <Route path="/fleet/drivers" element={<Protected fleetOnly><Shell withNav={false}><FleetDrivers /></Shell></Protected>} />
        <Route path="/fleet/payouts" element={<Protected fleetOnly><Shell withNav={false}><FleetPayouts /></Shell></Protected>} />
        <Route path="*" element={<Navigate to="/fleet" replace />} />
      </Routes>
    );
  }

  // ADMIN STANDALONE APP (admin.kjapp.no build)
  if (IS_ADMIN_APP) {
    return (
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password/:token" element={<PublicOnly><ResetPassword /></PublicOnly>} />
        <Route path="/auth/google" element={<GoogleCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin" element={<Protected adminOnly><AdminShell><AdminOverview /></AdminShell></Protected>} />
        <Route path="/admin/live" element={<Protected adminOnly><AdminShell><AdminLive /></AdminShell></Protected>} />
        <Route path="/admin/fleets" element={<Protected adminOnly><AdminShell><AdminFleets /></AdminShell></Protected>} />
        <Route path="/admin/fleets/:id" element={<Protected adminOnly><AdminShell><AdminFleetDetail /></AdminShell></Protected>} />
        <Route path="/admin/drivers" element={<Protected adminOnly><AdminShell><AdminDrivers /></AdminShell></Protected>} />
        <Route path="/admin/vehicles" element={<Protected adminOnly><AdminShell><AdminVehicles /></AdminShell></Protected>} />
        <Route path="/admin/trips" element={<Protected adminOnly><AdminShell><AdminTrips /></AdminShell></Protected>} />
        <Route path="/admin/bonus" element={<Protected adminOnly><AdminShell><AdminBonus /></AdminShell></Protected>} />
      <Route path="/admin/finance" element={<Protected adminOnly><AdminShell><AdminFinance /></AdminShell></Protected>} />
        <Route path="/admin/documents" element={<Protected adminOnly><AdminShell><AdminDocuments /></AdminShell></Protected>} />
        <Route path="/admin/support" element={<Protected adminOnly><AdminShell><AdminSupport /></AdminShell></Protected>} />
        <Route path="/admin/analytics" element={<Protected adminOnly><AdminShell><AdminAnalytics /></AdminShell></Protected>} />
        <Route path="/admin/audit" element={<Protected adminOnly><AdminShell><AdminAudit /></AdminShell></Protected>} />
        <Route path="/admin/settings" element={<Protected adminOnly><AdminShell><AdminSettings /></AdminShell></Protected>} />
        <Route path="/loyver" element={<Protected superadminOnly><AdminShell><SuperadminApplications /></AdminShell></Protected>} />
        <Route path="/loyver/applications/:id" element={<Protected superadminOnly><AdminShell><SuperadminApplicationDetail /></AdminShell></Protected>} />
        <Route path="/loyver/pending-drivers" element={<Protected superadminOnly><AdminShell><SuperadminPending /></AdminShell></Protected>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // MAIN APP (kunde + sjåfør)
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password/:token" element={<PublicOnly><ResetPassword /></PublicOnly>} />
      <Route path="/auth/google" element={<GoogleCallback />} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/voice-signin" element={<PublicOnly><VoiceSignIn /></PublicOnly>} />
      <Route path="/driver/login" element={<PublicOnly><DriverLogin /></PublicOnly>} />
      <Route path="/driver-signup/:token" element={<DriverSignup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />

      <Route path="/app" element={<Protected><Shell><Home /></Shell></Protected>} />
      <Route path="/app/booking/:tripId" element={<Protected><Shell withNav={false}><BookingFlow /></Shell></Protected>} />
      <Route path="/app/receipt/:tripId" element={<Protected><Shell withNav={false}><TripReceipt /></Shell></Protected>} />
      <Route path="/app/ai" element={<Protected><Shell withNav={false}><AIChat /></Shell></Protected>} />
      <Route path="/app/history" element={<Protected><Shell><TripHistory /></Shell></Protected>} />
      <Route path="/app/profile" element={<Protected><Shell><Profile /></Shell></Protected>} />
      <Route path="/app/payment" element={<Protected><Shell withNav={false}><PaymentMethods /></Shell></Protected>} />
      <Route path="/app/payment-methods" element={<Protected><Shell withNav={false}><PaymentMethods /></Shell></Protected>} />
      <Route path="/app/settings" element={<Protected><Shell withNav={false}><Settings /></Shell></Protected>} />
      <Route path="/app/help" element={<Protected><Shell withNav={false}><HelpSupport /></Shell></Protected>} />

      {/* Driver app */}
      <Route path="/driver" element={<Protected driverOnly><Shell driver><DriverHome /></Shell></Protected>} />
      <Route path="/driver/trip" element={<Protected driverOnly><Shell driver><DriverTrip /></Shell></Protected>} />
      <Route path="/driver/summary" element={<Protected driverOnly><Shell driver><DriverSummary /></Shell></Protected>} />
      <Route path="/driver/history" element={<Protected driverOnly><Shell driver><DriverHistory /></Shell></Protected>} />
      <Route path="/driver/payouts" element={<Protected driverOnly><Shell driver><DriverPayouts /></Shell></Protected>} />
      <Route path="/driver/profile" element={<Protected driverOnly><Shell driver><DriverProfile /></Shell></Protected>} />

      {/* Fleet owner */}
      <Route path="/fleet" element={<Protected fleetOnly><Shell withNav={false}><FleetOverview /></Shell></Protected>} />
      <Route path="/fleet/drivers" element={<Protected fleetOnly><Shell withNav={false}><FleetDrivers /></Shell></Protected>} />
      <Route path="/fleet/payouts" element={<Protected fleetOnly><Shell withNav={false}><FleetPayouts /></Shell></Protected>} />

      {/* Admin — full Operations Control Center */}
      <Route path="/admin" element={<Protected adminOnly><AdminShell><AdminOverview /></AdminShell></Protected>} />
      <Route path="/admin/live" element={<Protected adminOnly><AdminShell><AdminLive /></AdminShell></Protected>} />
      <Route path="/admin/fleets" element={<Protected adminOnly><AdminShell><AdminFleets /></AdminShell></Protected>} />
      <Route path="/admin/fleets/:id" element={<Protected adminOnly><AdminShell><AdminFleetDetail /></AdminShell></Protected>} />
      <Route path="/admin/drivers" element={<Protected adminOnly><AdminShell><AdminDrivers /></AdminShell></Protected>} />
      <Route path="/admin/vehicles" element={<Protected adminOnly><AdminShell><AdminVehicles /></AdminShell></Protected>} />
      <Route path="/admin/trips" element={<Protected adminOnly><AdminShell><AdminTrips /></AdminShell></Protected>} />
      <Route path="/admin/bonus" element={<Protected adminOnly><AdminShell><AdminBonus /></AdminShell></Protected>} />
      <Route path="/admin/finance" element={<Protected adminOnly><AdminShell><AdminFinance /></AdminShell></Protected>} />
      <Route path="/admin/documents" element={<Protected adminOnly><AdminShell><AdminDocuments /></AdminShell></Protected>} />
      <Route path="/admin/support" element={<Protected adminOnly><AdminShell><AdminSupport /></AdminShell></Protected>} />
      <Route path="/admin/analytics" element={<Protected adminOnly><AdminShell><AdminAnalytics /></AdminShell></Protected>} />
      <Route path="/admin/audit" element={<Protected adminOnly><AdminShell><AdminAudit /></AdminShell></Protected>} />
      <Route path="/admin/settings" element={<Protected adminOnly><AdminShell><AdminSettings /></AdminShell></Protected>} />

      {/* Public løyvehaver application */}
      <Route path="/apply/fleet" element={<ApplyFleet />} />

      {/* Superadmin — nå inne i Control Center */}
      <Route path="/loyver" element={<Protected superadminOnly><AdminShell><SuperadminApplications /></AdminShell></Protected>} />
      <Route path="/loyver/applications/:id" element={<Protected superadminOnly><AdminShell><SuperadminApplicationDetail /></AdminShell></Protected>} />
      <Route path="/loyver/pending-drivers" element={<Protected superadminOnly><AdminShell><SuperadminPending /></AdminShell></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  React.useEffect(() => {
    initNativeShell();
    if (isNative()) {
      // Register native push once app boots. Backend token registration only happens after auth,
      // but we can pre-request permission here so the prompt is not tied to a specific action.
      registerNativePush().catch(() => {});
      pushListenForeground((n) => {
        console.log("[push] foreground", n);
      });
      // Add native class for possible CSS tweaks (safe-area, no-scroll)
      document.body.classList.add("is-native");
    }
  }, []);
  return (
    <AuthProvider>
      <AppRoutes />
      <CookieConsent />
      <DevNavigator />
      <Toaster position="top-center" theme="dark" />
    </AuthProvider>
  );
}
