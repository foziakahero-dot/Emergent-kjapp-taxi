import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";
import { StatusBar } from "./components/UIKit";
import BottomNav from "./components/BottomNav";

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
import ApplyFleet from "./pages/ApplyFleet";
import SuperadminApplications from "./pages/SuperadminApplications";
import SuperadminApplicationDetail from "./pages/SuperadminApplicationDetail";
import SuperadminPending from "./pages/SuperadminPending";

function Protected({ children, driverOnly = false, adminOnly = false, fleetOnly = false, superadminOnly = false }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== "superadmin") return <Navigate to="/app" replace />;
  if (adminOnly && !["admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  if (fleetOnly && !["fleet_owner", "admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  if (driverOnly && !["driver", "admin", "superadmin"].includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSplash />;
  if (user) {
    const to = user.role === "superadmin" ? "/loyver" : user.role === "admin" ? "/admin" : user.role === "driver" ? "/driver" : user.role === "fleet_owner" ? "/fleet" : "/app";
    return <Navigate to={to} replace />;
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
      {withNav && (driver ? <DriverNav /> : <BottomNav />)}
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
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
      <Route path="/app/ai" element={<Protected><Shell><AIChat /></Shell></Protected>} />
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
  return (
    <AuthProvider>
      <AppRoutes />
      <CookieConsent />
    </AuthProvider>
  );
}
