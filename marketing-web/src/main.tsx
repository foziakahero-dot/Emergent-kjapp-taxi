import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { setPageSeo } from './seo';
import './styles.css';
import './responsive-fixes.css';

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
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
      title: 'KJAPP — Norsk taxi, uten omveier',
      description: 'Bestill norsk taxi med tekst eller stemme. Velg KJAPP, KJAPP XL eller Premium, se prisestimat og hentetid før du bekrefter, og følg bilen live.',
      canonical: 'https://kjappapp.no/',
    });
  }, [pathname]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteMetadata />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
