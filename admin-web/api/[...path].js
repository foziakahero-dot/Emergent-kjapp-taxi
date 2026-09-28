const BACKEND_ORIGIN = 'https://api.kjappapp.no';

export default async function handler(req, res) {
  try {
    const incomingUrl = new URL(req.url || '/', 'https://admin.kjappapp.no');
    const path = incomingUrl.pathname;

    // Keep the admin host as a narrow gateway: only auth + admin endpoints.
    if (!(path.startsWith('/api/auth/') || path.startsWith('/api/admin/'))) {
      return res.status(404).json({ detail: 'Not found' });
    }

    const target = `${BACKEND_ORIGIN}${path}${incomingUrl.search}`;
    const method = String(req.method || 'GET').toUpperCase();

    const headers = {
      accept: req.headers.accept || 'application/json',
    };

    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      if (req.body == null) {
        body = undefined;
      } else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
        if (!headers['content-type']) headers['content-type'] = 'application/json';
      }
    }

    const upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type');
    const contentDisposition = upstream.headers.get('content-disposition');

    if (contentType) res.setHeader('content-type', contentType);
    if (contentDisposition) res.setHeader('content-disposition', contentDisposition);
    res.setHeader('cache-control', 'no-store');

    return res.status(upstream.status).send(responseBody);
  } catch (error) {
    console.error('[kjapp-admin-proxy]', error);
    return res.status(502).json({ detail: 'KJAPP backend unavailable' });
  }
}
