const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
const configuredFleetUrl = import.meta.env.VITE_FLEET_URL?.trim();
const configuredContactDomain = import.meta.env.VITE_CONTACT_DOMAIN?.trim();

function runtimePublicOrigin() {
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "snarapp.no" || host === "www.snarapp.no") {
      return "https://snarapp.no";
    }
  }

  return "https://kjappapp.no";
}

export const PUBLIC_SITE_URL = runtimePublicOrigin();
export const FLEET_URL = configuredFleetUrl || "https://fleet.kjappapp.no";
export const CONTACT_DOMAIN = configuredContactDomain || "kjappapp.no";

export function contactEmail(localPart: string) {
  return `${localPart}@${CONTACT_DOMAIN}`;
}
