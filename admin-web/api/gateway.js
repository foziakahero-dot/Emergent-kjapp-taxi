import proxy from './[...path].js';

// Vite deployments need an explicit route to a named Vercel Function.
export default async function gateway(req, res) {
  const incoming = new URL(req.url || '/', 'https://admin.snarapp.no');
  const routedPath = req.query?.__snar_path || incoming.searchParams.get('__snar_path');
  if (typeof routedPath !== 'string' || !routedPath) {
    return res.status(404).json({ detail: 'Not found' });
  }
  incoming.searchParams.delete('__snar_path');
  return proxy({
    url: `/api/${routedPath}${incoming.search}`,
    method: req.method,
    body: req.body,
    headers: req.headers,
  }, res);
}
