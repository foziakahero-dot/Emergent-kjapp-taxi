export function kr(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return '– kr';
  return `${Math.round(value).toLocaleString('nb-NO')} kr`;
}

export function greeting(name?: string): string {
  const h = new Date().getHours();
  let g = 'God dag';
  if (h < 6) g = 'God natt';
  else if (h < 10) g = 'God morgen';
  else if (h < 18) g = 'God dag';
  else g = 'God kveld';
  const first = (name || '').trim().split(' ')[0];
  return first ? `${g}, ${first}` : g;
}

function detailText(detail: any): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const text = detail
      .map((d: any) => (typeof d?.msg === 'string' ? d.msg : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    return text || null;
  }
  if (typeof detail?.msg === 'string' && detail.msg.trim()) return detail.msg.trim();
  return null;
}

export function apiError(e: any): string {
  const status = Number(e?.response?.status || 0);
  const detail = detailText(e?.response?.data?.detail);

  if (!e?.response) {
    const code = String(e?.code || '').toUpperCase();
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(String(e?.message || ''))) {
      return 'Tilkoblingen tok for lang tid. Kontroller nettet og prøv igjen.';
    }
    return 'Ingen forbindelse til SNAR akkurat nå. Kontroller nettet og prøv igjen.';
  }

  if (status === 401) return 'Økten er utløpt eller innloggingen er ugyldig. Logg inn på nytt.';
  if (status === 403) return detail || 'Du har ikke tilgang til denne handlingen.';
  if (status === 404) return detail || 'Fant ikke det du ba om. Oppdater og prøv igjen.';
  if (status === 409) return detail || 'Handlingen kan ikke utføres i gjeldende status. Oppdater og prøv igjen.';
  if (status === 422) return detail || 'Noen opplysninger mangler eller er ugyldige. Kontroller feltene og prøv igjen.';
  if (status === 429) return detail || 'For mange forsøk på kort tid. Vent litt og prøv igjen.';
  if (status >= 500) return 'SNAR-tjenesten er midlertidig utilgjengelig. Prøv igjen om litt.';

  return detail || 'Noe gikk galt. Prøv igjen.';
}

export const VEHICLES: {
  type: 'enkelt' | 'ai-first' | 'trygg' | 'premium';
  name: string;
  tagline: string;
  seats: number;
}[] = [
  { type: 'ai-first', name: 'SNAR', tagline: 'Rask og enkel', seats: 4 },
  { type: 'enkelt', name: 'SNAR', tagline: 'Rask og enkel', seats: 4 },
  { type: 'trygg', name: 'SNAR XL', tagline: 'Mer plass · 7 seter', seats: 7 },
  { type: 'premium', name: 'Premium', tagline: 'Executive comfort', seats: 4 },
];

export function vehicleMeta(type: string) {
  return VEHICLES.find((v) => v.type === type) || VEHICLES[0];
}
