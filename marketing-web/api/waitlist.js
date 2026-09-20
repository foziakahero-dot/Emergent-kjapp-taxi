import crypto from 'node:crypto';

const ALLOWED_ROLES = new Set(['passenger', 'driver', 'fleet_owner']);

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Metoden støttes ikke.' });
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > 4096) return send(res, 413, { error: 'For stor forespørsel.' });

  let fields;
  try {
    fields = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return send(res, 400, { error: 'Kontroller feltene og prøv igjen.' });
  }

  if (!fields || typeof fields !== 'object') return send(res, 400, { error: 'Kontroller feltene og prøv igjen.' });

  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const phone = typeof fields.phone === 'string' ? fields.phone.trim() : '';
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  const city = typeof fields.city === 'string' ? fields.city.trim() : '';
  const role = String(fields.role || '');

  if (
    name.length < 2 || name.length > 100 ||
    !/^[+\d ()-]{8,30}$/.test(phone) ||
    city.length < 2 || city.length > 100 ||
    !ALLOWED_ROLES.has(role) ||
    (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    return send(res, 400, { error: 'Kontroller feltene og prøv igjen.' });
  }

  const endpoint = process.env.WAITLIST_WEBHOOK_URL;
  const secret = process.env.WAITLIST_WEBHOOK_SECRET;
  if (!endpoint || !secret) {
    return send(res, 503, { error: 'Ventelisten er ikke tilgjengelig akkurat nå. Kontakt support@kjappapp.no.' });
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return send(res, 503, { error: 'Ventelisten er ikke tilgjengelig akkurat nå.' });
  }
  if (url.protocol !== 'https:') return send(res, 503, { error: 'Ventelisten er ikke tilgjengelig akkurat nå.' });

  const normalizedIdentity = [role, phone.replace(/\s+/g, ''), email, city.toLowerCase()].join('|');
  const idempotencyKey = crypto.createHash('sha256').update(normalizedIdentity).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
        'Idempotency-Key': idempotencyKey,
        'X-KJAPP-Source': 'kjappapp.no',
      },
      body: JSON.stringify({
        name,
        phone,
        email,
        city,
        role,
        source: 'kjappapp.no',
        submitted_at: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return send(res, 502, { error: 'Påmeldingen kunne ikke lagres. Prøv igjen senere.' });
    }
    return send(res, 201, { ok: true });
  } catch {
    return send(res, 502, { error: 'Påmeldingen kunne ikke lagres. Prøv igjen senere.' });
  } finally {
    clearTimeout(timeout);
  }
}
