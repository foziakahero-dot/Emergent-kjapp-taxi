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
import DriverNav from "./components/DriverNav";
import DriverLogin from "./pages/DriverLogin";
import DriverSignup from "./pages/DriverSignup";
import AdminDashboard from "./pages/AdminDashboard";
import FleetOverview from "./pages/FleetOverview";
import FleetDrivers from "./pages/FleetDrivers";
import FleetPayouts from "./pages/FleetPayouts";
import AuthCallback from "./pages/AuthCallback";
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

// APP_MODE — la deg deploye samme kodebase som 3 separate apper:
//  - "main"  → kunde + sjåfør (kjapp.no)
//  - "fleet" → kun flåte-eier (fleet.kjapp.no)
//  - "admin" → kun superadmin (admin.kjapp.no)
// Sett REACT_APP_MODE i .env for det bygg du lager. Default = "main".
const APP_MODE = (process.env.REACT_APP_MODE || "main").toLowerCase();
const IS_FLEET_APP = APP_MODE === "fleet";
const IS_ADMIN_APP = APP_MODE === "admin";
const IS_STANDALONE = IS_FLEET_APP || IS_ADMIN_APP;

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
  if (superadminOnly && user.role !== "superadmin") return <Navigate to="/app" replace />;
  if (adminOnly && !["admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  if (fleetOnly && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  if (driverOnly && !["driver", "admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  // In standalone modes (fleet.kjapp.no / admin.kjapp.no) block wrong roles from browsing customer routes
  if (IS_FLEET_APP && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <Navigate to="/login" replace />;
  if (IS_ADMIN_APP && !["admin", "superadmin"].includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSplash />;
  if (user) return <Navigate to={redirectAfterLogin(user)} replace />;
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
      {withNav && (driver ? <DriverNav /> : <BottomNav />)}
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  // FLEET STANDALONE APP (fleet.kjapp.no build)
  if (IS_FLEET_APP) {
    return (
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin" element={<Protected adminOnly><AdminDashboard /></Protected>} />
        <Route path="/loyver" element={<Protected superadminOnly><SuperadminApplications /></Protected>} />
        <Route path="/loyver/applications/:id" element={<Protected superadminOnly><SuperadminApplicationDetail /></Protected>} />
        <Route path="/loyver/pending-drivers" element={<Protected superadminOnly><SuperadminPending /></Protected>} />
        <Route path="*" element={<Navigate to="/loyver" replace />} />
      </Routes>
    );
  }

  // MAIN APP (kunde + sjåfør)
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
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

      {/* Admin */}
      <Route path="/admin" element={<Protected adminOnly><AdminDashboard /></Protected>} />

      {/* Public løyvehaver application */}
      <Route path="/apply/fleet" element={<ApplyFleet />} />

      {/* Superadmin (kun for eier) */}
      <Route path="/loyver" element={<Protected superadminOnly><SuperadminApplications /></Protected>} />
      <Route path="/loyver/applications/:id" element={<Protected superadminOnly><SuperadminApplicationDetail /></Protected>} />
      <Route path="/loyver/pending-drivers" element={<Protected superadminOnly><SuperadminPending /></Protected>} />

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
    </AuthProvider>
  );
}
