import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactDOMClient from 'react-dom/client';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import App from './App';
import HelpPage from './HelpPage';
import { setPageSeo } from './seo';
import CookieConsent from './CookieConsent';
import './styles.css';
import './responsive-fixes.css';
import './support-footer.css';
import './production-readiness.css';

const SUPPORT_EMAIL = 'support@kjappapp.no';

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/help') {
      setPageSeo({
        title: 'KJAPP Hjelp & support',
        description: 'Få hjelp med turer, betaling, konto, sjåfør- eller løyvehaverspørsmål. KJAPP support svarer på support@kjappapp.no.',
        canonical: 'https://kjappapp.no/help',
      });
      return;
    }

    if (pathname === '/loyvehaver') {
      setPageSeo({
        title: 'KJAPP for løyvehavere — Fleet Panel og norsk oppfølging',
        description: 'Bli KJAPP-partner. Fleet Panel samler sjåfører, turer, dokumentasjon og oppgjør for norske løyvehavere.',
        canonical: 'https://kjappapp.no/loyvehaver',
      });
      return;
    }

    if (pathname === '/loyvehaver/soknad') {
      setPageSeo({
        title: 'KJAPP Partner — løyvehaversøknad',
        description: 'Søk om å bli KJAPP-partner og send nødvendig dokumentasjon for kontroll før Fleet-tilgang aktiveres.',
        canonical: 'https://kjappapp.no/loyvehaver/soknad',
        robots: 'noindex,nofollow',
      });
      return;
    }

    setPageSeo({
      title: 'KJAPP – Reis smart',
      description: 'KJAPP er en norsk taxi-app med smart bestilling, tydelige prisestimater og løsninger for passasjerer, sjåfører og løyvehavere.',
      canonical: 'https://kjappapp.no/',
    });
  }, [pathname]);

  return null;
}

function SupportFooterPortal() {
  const { pathname } = useLocation();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname === '/help') {
      setTarget(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setTarget(document.querySelector<HTMLElement>('.mk-footer'));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <div className="mk-support-footer" aria-label="KJAPP support">
      <Link to="/help">Hjelp & support</Link>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </div>,
    target,
  );
}

function RootContent() {
  const { pathname } = useLocation();
  return pathname === '/help' ? <HelpPage /> : <App />;
}

ReactDOMClient.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteMetadata />
      <RootContent />
      <SupportFooterPortal />
      <CookieConsent />
    </BrowserRouter>
  </React.StrictMode>,
);
