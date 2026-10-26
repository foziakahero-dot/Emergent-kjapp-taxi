import assert from 'node:assert/strict';

const documentBytes = Buffer.from([1, 2, 255, 4]);
let target;
globalThis.fetch = async (url, options) => {
  target = { url, options };
  return new Response(documentBytes, { headers: { 'content-type': 'application/pdf' } });
};
function response() {
  return { headers: {}, code: 200,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.code = c; return this; },
    json(v) { this.value = v; return this; },
    send(v) { this.value = v; return this; } };
}
for (const environment of ['qa', 'production', 'unconfigured-preview']) {
  process.env.VERCEL_GIT_COMMIT_REF = environment === 'qa'
    ? 'qa/snar-v10-phase5-staging-e2e' : 'feature/other';
  process.env.VERCEL_ENV = environment === 'production' ? 'production' : 'preview';
  for (const panel of ['admin-web', 'fleet-web']) {
    const file = panel === 'admin-web' ? '../admin-web/api/[...path].js' : '../fleet-web/api/gateway.js';
    const { default: handler } = await import(`${file}?${environment}`);
    target = null;
    const res = response();
    await handler({
      url: panel === 'admin-web' ? '/api/files/kjapp/test.pdf'
        : '/api/gateway?__snar_path=files/kjapp/test.pdf',
      method: 'GET', headers: { authorization: 'Bearer synthetic' }, query: {},
    }, res);
    if (environment === 'unconfigured-preview') {
      assert.equal(res.code, 503); assert.equal(target, null); continue;
    }
    assert.ok(target.url.startsWith(environment === 'qa'
      ? 'https://api-qa.snarapp.no/' : 'https://api.kjappapp.no/'));
    assert.equal(target.options.headers.authorization, 'Bearer synthetic');
    assert.deepEqual(res.value, documentBytes);
    assert.equal(res.headers['cache-control'], 'no-store');
    if (panel === 'fleet-web') {
      const upload = { url: '/api/gateway?__snar_path=fleet/vehicles/test/documents',
        method: 'POST', query: {}, headers: {
          authorization: 'Bearer synthetic', 'content-type': 'multipart/form-data; boundary=test',
        }, async *[Symbol.asyncIterator]() { yield documentBytes; } };
      await handler(upload, response());
      assert.deepEqual(target.options.body, documentBytes);
      assert.equal(target.options.headers['content-type'], 'multipart/form-data; boundary=test');
    }
  }
}
console.log('PASS: QA/production routing, unconfigured preview isolation and private binary document forwarding.');
