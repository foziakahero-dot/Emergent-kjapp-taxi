import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { setPageSeo } from './seo';

type Kind = 'privacy' | 'terms';

export default function LegalPage({ kind }: { kind: Kind }) {
  const privacy = kind === 'privacy';

  useEffect(() => {
    setPageSeo({
      title: privacy ? 'KJAPP Personvern' : 'KJAPP Vilkår',
      description: privacy
        ? 'Personverninformasjon for KJAPP beta.'
        : 'Vilkårsinformasjon for KJAPP beta.',
      canonical: privacy ? 'https://kjappapp.no/personvern' : 'https://kjappapp.no/vilkar',
    });
  }, [privacy]);

  return (
    <main style={{ minHeight: '100vh', background: '#05090d', color: '#f7f9fb', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <header style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1d2a3d' }}>
        <Link to="/" style={{ color: '#f7f9fb', textDecoration: 'none', fontWeight: 900, fontSize: 24 }}>KJAPP</Link>
        <Link to="/help" style={{ color: '#11d9e8', textDecoration: 'none', fontWeight: 700 }}>Hjelp</Link>
      </header>
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px 96px' }}>
        <div style={{ color: '#11d9e8', fontSize: 11, fontWeight: 900, letterSpacing: '.1em' }}>KJAPP · BETA</div>
        <h1 style={{ fontSize: 46, margin: '18px 0 18px', letterSpacing: '-.04em' }}>{privacy ? 'Personvern' : 'Vilkår'}</h1>
        <p style={{ color: '#aab6c6', lineHeight: 1.7, fontSize: 17 }}>
          {privacy
            ? 'Denne siden er opprettet som fast personvernadresse for KJAPP. Endelig juridisk godkjent personvernerklæring publiseres her før offentlig kommersiell lansering.'
            : 'Denne siden er opprettet som fast vilkårsadresse for KJAPP. Endelig juridisk godkjente kunde-, sjåfør- og plattformvilkår publiseres her før offentlig kommersiell lansering.'}
        </p>
        <div style={{ marginTop: 32, padding: 22, border: '1px solid #233144', borderRadius: 18, background: '#0c1420' }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>{privacy ? 'Personvernkontakt' : 'Spørsmål om vilkår'}</strong>
          <a href={privacy ? 'mailto:privacy@kjappapp.no' : 'mailto:support@kjappapp.no'} style={{ color: '#11d9e8' }}>
            {privacy ? 'privacy@kjappapp.no' : 'support@kjappapp.no'}
          </a>
        </div>
        <p style={{ color: '#78889d', lineHeight: 1.7, fontSize: 13, marginTop: 26 }}>
          Denne betasiden erstatter ikke den endelige juridiske teksten. Den gjør URL-en stabil for appene mens teksten ferdigstilles og godkjennes.
        </p>
      </section>
    </main>
  );
}
