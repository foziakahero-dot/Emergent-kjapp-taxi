import { strFromU8, unzipSync } from 'fflate';
import { api } from './api';

export type FleetWorkbookTrip = {
  date: string;
  tripId: string;
  driver: string;
  from: string;
  to: string;
  distanceKm: number;
  price: number;
  payment: string;
  status: string;
};

export type FleetWorkbookSummary = {
  period: string;
  trips: number;
  gross: number;
  commission: number;
  net: number;
  activeDrivers: number;
};

export type FleetWorkbook = {
  summary: FleetWorkbookSummary;
  trips: FleetWorkbookTrip[];
};

type Zip = Record<string, Uint8Array>;

const cache = new Map<string, Promise<FleetWorkbook>>();

const text = (zip: Zip, path: string) => {
  const data = zip[path];
  if (!data) return '';
  return strFromU8(data);
};

const colIndex = (ref: string) => {
  const letters = (ref.match(/[A-Z]+/i)?.[0] || 'A').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
};

const nodeText = (el: Element | null) => el?.textContent ?? '';

function sharedStrings(zip: Zip) {
  const xml = text(zip, 'xl/sharedStrings.xml');
  if (!xml) return [] as string[];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map((si) =>
    Array.from(si.getElementsByTagName('t')).map((t) => nodeText(t)).join(''),
  );
}

function parseRows(zip: Zip, path: string, shared: string[]) {
  const xml = text(zip, path);
  if (!xml) return [] as Array<Array<string | number>>;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rows: Array<Array<string | number>> = [];
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const out: Array<string | number> = [];
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const index = colIndex(cell.getAttribute('r') || 'A1');
      const type = cell.getAttribute('t') || '';
      let value: string | number = '';
      if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagName('t')).map((t) => nodeText(t)).join('');
      } else {
        const raw = nodeText(cell.getElementsByTagName('v')[0] || null);
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'str') value = raw;
        else if (raw !== '' && Number.isFinite(Number(raw))) value = Number(raw);
        else value = raw;
      }
      out[index] = value;
    }
    rows.push(out);
  }
  return rows;
}

const num = (v: unknown) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[^0-9,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function parseFleetWorkbook(buffer: ArrayBuffer): FleetWorkbook {
  const zip = unzipSync(new Uint8Array(buffer)) as Zip;
  const shared = sharedStrings(zip);
  const summaryRows = parseRows(zip, 'xl/worksheets/sheet1.xml', shared);
  const tripRows = parseRows(zip, 'xl/worksheets/sheet3.xml', shared);

  const summaryMap = new Map<string, string | number>();
  for (const row of summaryRows) {
    if (typeof row[0] === 'string' && row[1] !== undefined) summaryMap.set(row[0], row[1]);
  }
  const find = (prefix: string) => {
    const item = Array.from(summaryMap.entries()).find(([k]) => k.toLowerCase().startsWith(prefix.toLowerCase()));
    return item?.[1] ?? 0;
  };
  const periodRow = summaryRows.find((r) => String(r[0] || '').startsWith('Periode:'));
  const period = String(periodRow?.[0] || '').replace('Periode:', '').trim();

  const headers = (tripRows[0] || []).map((v) => String(v || '').trim().toLowerCase());
  const ix = (needle: string) => headers.findIndex((h) => h.includes(needle));
  const iDate = ix('dato');
  const iId = ix('tur id');
  const iDriver = ix('sjåfør');
  const iFrom = ix('hentested');
  const iTo = ix('destinasjon');
  const iDist = ix('distanse');
  const iPrice = ix('pris');
  const iPayment = ix('betaling');
  const iStatus = ix('status');

  const trips: FleetWorkbookTrip[] = tripRows.slice(1)
    .filter((r) => r.some((v) => v !== undefined && v !== ''))
    .map((r) => ({
      date: String(r[iDate] ?? ''),
      tripId: String(r[iId] ?? ''),
      driver: String(r[iDriver] ?? '—'),
      from: String(r[iFrom] ?? '—'),
      to: String(r[iTo] ?? '—'),
      distanceKm: num(r[iDist]),
      price: num(r[iPrice]),
      payment: String(r[iPayment] ?? '—'),
      status: String(r[iStatus] ?? ''),
    }));

  return {
    summary: {
      period,
      trips: num(find('Antall turer')),
      gross: num(find('Brutto omsetning')),
      commission: num(find('Provisjon')),
      net: num(find('Netto til flåte')),
      activeDrivers: num(find('Antall aktive sjåfører')),
    },
    trips,
  };
}

export function loadFleetWorkbook(year: number, month: number) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  if (!cache.has(key)) {
    cache.set(key, api.exportMonthly(year, month).then(parseFleetWorkbook));
  }
  return cache.get(key)!;
}

export function clearFleetWorkbookCache() {
  cache.clear();
}
