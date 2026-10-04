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
  const website = typeof fields.website === 'string' ? fields.website.trim() : '';

  if (
    name.length < 2 || name.length > 100 ||
    !/^[+\d ()-]{8,30}$/.test(phone) ||
    city.length < 2 || city.length > 100 ||
    !ALLOWED_ROLES.has(role) ||
    website.length > 200 ||
    (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    return send(res, 400, { error: 'Kontroller feltene og prøv igjen.' });
  }

  const apiBase = (process.env.KJAPP_API_BASE_URL || 'https://api.kjappapp.no/api').replace(/\/$/, '');
  let endpoint;
  try {
    endpoint = new URL(`${apiBase}/marketing/waitlist`);
  } catch {
    return send(res, 503, { error: 'Ventelisten er ikke tilgjengelig akkurat nå. Kontakt support@kjappapp.no.' });
  }
  if (endpoint.protocol !== 'https:') {
    return send(res, 503, { error: 'Ventelisten er ikke tilgjengelig akkurat nå. Kontakt support@kjappapp.no.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KJAPP-Source': 'kjappapp.no',
      },
      body: JSON.stringify({ name, phone, email, city, role, website }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const safeMessage =
        response.status === 429 && typeof data?.detail === 'string'
          ? data.detail
          : 'Påmeldingen kunne ikke lagres. Prøv igjen senere.';
      return send(res, response.status === 429 ? 429 : 502, { error: safeMessage });
    }

    return send(res, 201, { ok: true, status: 'registered' });
  } catch {
    return send(res, 502, { error: 'Påmeldingen kunne ikke lagres. Prøv igjen senere.' });
  } finally {
    clearTimeout(timeout);
  }
}
