import React from "react";
import { Radio, DollarSign, FileText, LifeBuoy, TrendingUp, Settings, Car, Users, Route } from "lucide-react";

/** Placeholder-side for Phase 2 seksjoner. Beholder Nordic identitet, vises som "kommer snart". */
export function AdminPlaceholder({ title, description, Icon = Settings, testid }) {
  return (
    <div className="card p-10 text-center max-w-xl mx-auto" data-testid={testid}>
      <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <Icon size={22} />
      </div>
      <div className="font-display text-[22px] mb-1" style={{ color: "var(--text)" }}>{title}</div>
      <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>{description}</div>
      <div className="text-[10px] uppercase tracking-[0.3em] mt-4" style={{ color: "var(--accent)" }}>Kommer i Phase 2</div>
    </div>
  );
}

export const AdminLive       = () => <AdminPlaceholder testid="admin-live" title="Live drift"  description="Sanntidskart, aktive turer og sjåfør-lokasjon på ett brett. Integrasjon mot GPS-heartbeat kobles inn i Phase 2." Icon={Radio} />;
export const AdminDrivers    = () => <AdminPlaceholder testid="admin-drivers" title="Sjåfører" description="Full sjåfør-liste med filtre, dokumentstatus og profil-oversikt. Backend-API er allerede tilgjengelig (/admin/drivers)." Icon={Users} />;
export const AdminVehicles   = () => <AdminPlaceholder testid="admin-vehicles" title="Kjøretøy" description="Kjøretøy-register med klasse (KJAPP · KJAPP+ · XL), dokumentasjon og tildeling." Icon={Car} />;
export const AdminTrips      = () => <AdminPlaceholder testid="admin-trips" title="Turer" description="Turhistorikk, filtre, hendelses-tidslinje og reversering ved feil." Icon={Route} />;
export const AdminFinance    = () => <AdminPlaceholder testid="admin-finance" title="Finans" description="GMV, KJAPP-provisjon, avstemming og CSV-eksport. Krever Stripe/Vipps-oppsett først." Icon={DollarSign} />;
export const AdminDocuments  = () => <AdminPlaceholder testid="admin-documents" title="Dokumenter" description="Løyver, sjåførbevis, forsikring — med utløps-varsling 30/14/7 dager." Icon={FileText} />;
export const AdminSupport    = () => <AdminPlaceholder testid="admin-support" title="Support" description="Sakssystem med kategori, prioritet og intern historikk." Icon={LifeBuoy} />;
export const AdminAnalytics  = () => <AdminPlaceholder testid="admin-analytics" title="Analyse" description="Aksept-rate, kanselleringer, gjennomsnittspris, ETA-trender." Icon={TrendingUp} />;
export const AdminSettings   = () => <AdminPlaceholder testid="admin-settings" title="Innstillinger" description="Ride-klasser, kommisjon-standard, feature flags." Icon={Settings} />;
