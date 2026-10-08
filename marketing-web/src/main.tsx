import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactDOMClient from "react-dom/client";
import { BrowserRouter, Link, useLocation } from "react-router-dom";
import App from "./App";
import HelpPage from "./HelpPage";
import { setPageSeo } from "./seo";
import CookieConsent from "./CookieConsent";
import { contactEmail, PUBLIC_SITE_URL } from "./siteConfig";
import "./snar-tokens.css";
import "./production-readiness.css";
import "./snar-landing.css";

const SUPPORT_EMAIL = contactEmail("support");
const canonical = (path = "/") => `${PUBLIC_SITE_URL}${path === "/" ? "/" : path}`;

function RouteMetadata() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView(),
      );
    } else {
      window.scrollTo(0, 0);
    }

    if (pathname === "/personvern" || pathname === "/vilkar") {
      setPageSeo({
        title: pathname === "/personvern" ? "SNAR Personvern" : "SNAR Vilkår",
        description: "Informasjon for SNAR beta.",
        canonical: canonical(pathname),
      });
      return;
    }

    if (pathname.startsWith("/tur/")) {
      setPageSeo({
        title: "SNAR Delt tur",
        description: "Delt turstatus.",
        canonical: canonical(pathname),
        robots: "noindex,nofollow",
      });
      return;
    }

    if (pathname === "/help") {
      setPageSeo({
        title: "SNAR | Spørsmål, hjelp og support",
        description:
          "Svar på spørsmål om SNAR, bestilling, prisestimat, sjåfører, betaling og Oslo-beta. Få hjelp som kunde, sjåfør eller løyvehaver.",
        canonical: canonical("/help"),
      });
      return;
    }

    if (pathname === "/loyvehaver") {
      setPageSeo({
        title: "SNAR for løyvehavere | Bestillinger, drift og oppgjør",
        description:
          "SNAR er en bestillings- og formidlingsplattform for profesjonelle aktører. Søk om partnerskap og få oversikt over drift og oppgjør i SNAR Fleet.",
        canonical: canonical("/loyvehaver"),
      });
      return;
    }

    if (pathname === "/loyvehaver/soknad") {
      setPageSeo({
        title: "SNAR Partner — løyvehaversøknad",
        description:
          "Søk om å bli SNAR-partner og send nødvendig dokumentasjon for kontroll før Fleet-tilgang aktiveres.",
        canonical: canonical("/loyvehaver/soknad"),
        robots: "noindex,nofollow",
      });
      return;
    }

    setPageSeo({
      title: "SNAR – Bestill bil med sjåfør | Oslo-beta",
      description:
        "Bestill bil med sjåfør i SNAR. Se prisestimat, følg sjåføren og betal i appen. Norsk mobilitetsplattform. Meld interesse for Oslo-betaen.",
      canonical: canonical("/"),
    });
  }, [pathname, hash]);

  return null;
}

function SupportFooterPortal() {
  const { pathname } = useLocation();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname === "/help") {
      setTarget(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setTarget(document.querySelector<HTMLElement>(".mk-footer"));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <div className="mk-support-footer" aria-label="SNAR support">
      <Link to="/help">Hjelp & support</Link>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </div>,
    target,
  );
}

function RootContent() {
  const { pathname } = useLocation();
  return pathname === "/help" ? <HelpPage /> : <App />;
}

ReactDOMClient.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteMetadata />
      <RootContent />
      <SupportFooterPortal />
      <CookieConsent />
    </BrowserRouter>
  </React.StrictMode>,
);
