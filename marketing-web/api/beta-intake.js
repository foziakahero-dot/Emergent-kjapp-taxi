/**
 * SNAR Oslo Beta: QA-only, fail-closed Vercel preview intake.
 * This endpoint is deliberately separate from the existing production
 * /api/waitlist handler and must never accept production traffic.
 *
 * Request flow: /beta modal -> /beta-intake -> this function ->
 * https://api-qa.snarapp.no/api/marketing/waitlist.
 */
const QA_ENDPOINT = "https://api-qa.snarapp.no/api/marketing/waitlist";
const ALLOWED_ROLES = new Set(["passenger"]); // Customer beta only.

function send(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Metoden støttes ikke." });
  }

  // Only preview builds; never make this endpoint live merely by merging.
  if (process.env.VERCEL_ENV !== "preview") {
    return send(res, 503, { error: "Beta-påmelding er ennå ikke åpnet på denne siden." });
  }

  // Dedicated deployment toggle; this must be set for the reviewed preview.
  if (process.env.SNAR_BETA_QA_INTAKE_ENABLED !== "true") {
    return send(res, 503, { error: "Beta-testen åpner etter at QA-koblingen er verifisert." });
  }

  const length = Number(req.headers["content-length"] || 0);
  if (length > 4096) return send(res, 413, { error: "For stor forespørsel." });

  let fields;
  try { fields = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return send(res, 400, { error: "Kontroller feltene og prøv igjen." }); }
  if (!fields || Array.isArray(fields) || typeof fields !== "object")
    return send(res, 400, { error: "Kontroller feltene og prøv igjen." });

  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const city = typeof fields.city === "string" ? fields.city.trim() : "";
  const role = fields.role;
  const website = typeof fields.website === "string" ? fields.website.trim() : "";

  if (name.length < 2 || name.length > 100 ||
      !/^[+\d ()-]{8,30}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 8 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      city.length < 2 || city.length > 100 || !ALLOWED_ROLES.has(role) ||
      website.length > 200)
    return send(res, 400, { error: "Kontroller feltene og prøv igjen." });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const upstream = await fetch(QA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SNAR-Source": "beta-preview" },
      body: JSON.stringify({ name, phone, email, city, role, website }),
      signal: controller.signal,
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const error = upstream.status === 429 ? "For mange forespørsler akkurat nå." : "Registreringen kunne ikke lagres i QA. Prøv igjen.";
      return send(res, upstream.status === 429 ? 429 : 502, { error });
    }
    if (body.ok !== true || body.status !== "registered")
      return send(res, 502, { error: "Uventet bekreftelse fra QA." });
    const emailStatus = typeof body.confirmation_email_status === "string" ? body.confirmation_email_status : undefined;
    return send(res, 201, { ok: true, status: "registered", ...(emailStatus ? { confirmation_email_status: emailStatus } : {}) });
  } catch {
    return send(res, 502, { error: "Kunne ikke kontakte SNAR QA akkurat nå." });
  } finally {
    clearTimeout(timeout);
  }
}
