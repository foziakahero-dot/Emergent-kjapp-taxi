// Keep preview reads and writes in the same database as the QA mobile apps.
export const config = { api: { bodyParser: false } };
const QA_BRANCH = 'qa/snar-v10-phase5-staging-e2e';
const ORIGIN = process.env.VERCEL_GIT_COMMIT_REF === QA_BRANCH
  ? 'https://api-qa.snarapp.no'
  : process.env.VERCEL_ENV === 'production' ? 'https://api.kjappapp.no' : null;

export default async function gateway(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!ORIGIN) return res.status(503).json({ detail: 'API is disabled for this preview' });
  const incoming = new URL(req.url || '/', 'https://fleet.snarapp.no');
  const path = req.query?.__snar_path || incoming.searchParams.get('__snar_path');
  if (typeof path !== 'string' || !path || path.includes('..') || path.includes('\\') || !/^[a-zA-Z0-9_./%-]+$/.test(path)) {
    return res.status(404).json({ detail: 'Not found' });
  }
  incoming.searchParams.delete('__snar_path');
  const method = String(req.method || 'GET').toUpperCase();
  const headers = { accept: req.headers.accept || 'application/json' };
  for (const key of ['authorization', 'content-type']) if (req.headers[key]) headers[key] = req.headers[key];
  try {
    const chunks = []; let size = 0;
    if (!['GET', 'HEAD'].includes(method)) {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 9 * 1024 * 1024) return res.status(413).json({ detail: 'Filen er for stor' });
        chunks.push(chunk);
      }
    }
    const upstream = await fetch(`${ORIGIN}/api/${path}${incoming.search}`, {
      method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: 'manual', signal: AbortSignal.timeout(25000),
    });
    for (const key of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(key); if (value) res.setHeader(key, value);
    }
    return res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(502).json({ detail: 'SNAR backend unavailable' });
  }
}
