export function kr(value?: number | null): string {
  if (value == null || isNaN(value as number)) return '– kr';
  return `${Math.round(value)} kr`;
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
  if (detail == null) return e?.message || 'Noe gikk galt. Prøv igjen.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail.map((d: any) => (d?.msg ? d.msg : JSON.stringify(d))).join(' ');
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const VEHICLES: {
  type: 'enkelt' | 'ai-first' | 'trygg' | 'premium';
  name: string;
  tagline: string;
  seats: number;
}[] = [
  { type: 'ai-first', name: 'KJAPP', tagline: 'Standard', seats: 4 },
  { type: 'enkelt', name: 'Sparsom', tagline: 'Beste pris', seats: 4 },
  { type: 'trygg', name: 'Komfort XL', tagline: '7 seter', seats: 7 },
  { type: 'premium', name: 'Premium', tagline: 'Business', seats: 4 },
];

export function vehicleMeta(type: string) {
  return VEHICLES.find((v) => v.type === type) || VEHICLES[0];
}
