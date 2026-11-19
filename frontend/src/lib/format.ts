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

export function apiError(e: any): string {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail)) return 'Sjekk at du har fylt ut alle feltene riktig.';
  if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') {
    return 'Det tar litt tid å få svar. Prøv igjen om litt.';
  }
  if (e?.code === 'ERR_NETWORK' || /^(Network Error|Network request failed|Failed to fetch)$/i.test(e?.message ?? '')) {
    return 'Vi får ikke kontakt med SNAR. Sjekk nettforbindelsen og prøv igjen.';
  }
  const message = typeof detail === 'string' ? detail : detail?.msg ?? e?.message;
  if (typeof message === 'string' && message.trim() &&
      !/^(Request failed with status code|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout|Not Found$)/i.test(message)) {
    return message;
  }
  return 'Noe gikk galt. Prøv igjen om litt.';
}

export const VEHICLES: {
  type: 'enkelt' | 'ai-first' | 'trygg' | 'premium' | 'suv';
  name: string;
  tagline: string;
  seats: number;
}[] = [
  { type: 'ai-first', name: 'Standard', tagline: 'Rask og enkel', seats: 4 },
  { type: 'enkelt', name: 'Standard', tagline: 'Rask og enkel', seats: 4 },
  { type: 'trygg', name: 'SNAR XL', tagline: 'Mer plass · 7 seter', seats: 7 },
  { type: 'suv', name: 'SUV', tagline: 'Romslig SUV', seats: 5 },
  { type: 'premium', name: 'Premium', tagline: 'Ekstra komfort', seats: 4 },
];

export function vehicleMeta(type: string) {
  return VEHICLES.find((v) => v.type === type) || VEHICLES[0];
}
