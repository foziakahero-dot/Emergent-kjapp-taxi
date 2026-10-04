const RAW_BASE = import.meta.env.VITE_API_BASE_URL || 'https://github-app-builder-28.emergent.host/api';
export const API_BASE = RAW_BASE.replace(/\/$/, '');

export type FleetDraft = {
  company_name: string;
  org_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  license_count?: number;
  vehicle_count?: number;
  bank_account?: string;
  notes?: string;
  accepted_terms?: boolean;
  legal_version?: string;
};

export type UploadedDocument = {
  path: string;
  original_filename: string;
  content_type: string;
};

async function parseError(res: Response) {
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((x: any) => x?.msg || String(x)).join(', ');
    }
    if (typeof detail === 'string') return detail;
  } catch {}
  return `Forespørselen feilet (${res.status})`;
}

export async function createFleetDraft(data: FleetDraft): Promise<{ upload_token: string; status: string }> {
  // The current production intake stores the free-text notes field but does not yet
  // expose structured license/vehicle count fields. Preserve those values in notes
  // so superadmin sees them immediately without creating a parallel backend model.
  const operationalNotes = [
    data.notes?.trim(),
    data.license_count ? `Antall løyver: ${data.license_count}` : '',
    data.vehicle_count ? `Antall biler: ${data.vehicle_count}` : '',
  ].filter(Boolean).join('\n');

  const payload = { ...data, notes: operationalNotes };
  const res = await fetch(`${API_BASE}/fleet-applications/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadFleetDocument(file: File, token: string): Promise<{
  storage_path: string;
  original_filename: string;
  content_type: string;
}> {
  const body = new FormData();
  body.append('file', file);
  body.append('application_token', token);
  const res = await fetch(`${API_BASE}/upload/public`, { method: 'POST', body });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function submitFleetApplication(uploadToken: string, documents: Record<string, UploadedDocument>) {
  const res = await fetch(`${API_BASE}/fleet-applications/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_token: uploadToken, documents }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}


export async function getSharedTrip(token: string) {
  const res = await fetch(`${API_BASE}/trips/share/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function checkPasswordResetToken(token: string) {
  const res = await fetch(`${API_BASE}/auth/reset-password/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createPublicSupportTicket(data: {
  topic: 'tur' | 'betaling' | 'konto' | 'sjafor' | 'loyvehaver' | 'annet';
  name?: string;
  contact: string;
  message: string;
}) {
  const res = await fetch(`${API_BASE}/support/public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

