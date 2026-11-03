/**
 * SNAR beta QA intake for Netlify branch/deploy previews.
 * Never routes public production traffic to QA, and fails closed by default.
 */
const QA_ENDPOINT = "https://api-qa.snarapp.no/api/marketing/waitlist";

function json(status, data) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json(405, { error: "Metoden støttes ikke." });

  const deployContext = context?.deploy?.context;
  if (deployContext !== "deploy-preview" && deployContext !== "branch-deploy") {
    return json(503, { error: "Beta-påmelding er ikke åpnet i produksjon." });
  }

  // Deploy previews cannot send real registrations until QA is reviewed.
  const enabled = Netlify.env.get("SNAR_BETA_QA_INTAKE_ENABLED") === "true";
  if (!enabled) return json(503, { error: "Beta-påmelding åpner etter verifisert QA-test." });

  const length = Number(request.headers.get("content-length") || "0");
  if (length > 4096) return json(413, { error: "For stor forespørsel." });

  let fields;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json(413, { error: "For stor forespørsel." });
    fields = JSON.parse(raw);
  } catch {
    return json(400, { error: "Kontroller feltene og prøv igjen." });
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return json(400, { error: "Kontroller feltene og prøv igjen." });

  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const city = typeof fields.city === "string" ? fields.city.trim() : "";
  const website = typeof fields.website === "string" ? fields.website.trim() : "";
  const role = fields.role;

  if (name.length < 2 || name.length > 100 ||
      !/^[+\d ()-]{8,30}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 8 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      city.length < 2 || city.length > 100 ||
      role !== "passenger" || website.length > 200)
    return json(400, { error: "Kontroller feltene og prøv igjen." });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(QA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SNAR-Source": "beta-netlify-preview" },
      body: JSON.stringify({ name, phone, email, city, role, website }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      return json(response.status === 429 ? 429 : 502, {
        error: response.status === 429
          ? "For mange forespørsler akkurat nå."
          : "Registreringen kunne ikke lagres i QA. Prøv igjen.",
      });
    if (data.ok !== true || data.status !== "registered")
      return json(502, { error: "Uventet bekreftelse fra QA." });

    const emailStatus = typeof data.confirmation_email_status === "string" ? data.confirmation_email_status : undefined;
    return json(201, { ok: true, status: "registered", ...(emailStatus ? { confirmation_email_status: emailStatus } : {}) });
  } catch {
    return json(502, { error: "Kunne ikke kontakte SNAR QA akkurat nå." });
  } finally {
    clearTimeout(timer);
  }
}
