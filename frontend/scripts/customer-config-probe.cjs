// Safe build-environment inspection: never prints tokens or Firebase API keys.
const fs = require('fs');
const https = require('https');
const raw = process.env.GOOGLE_SERVICES_JSON || '';
let google = { present: !!raw, readable: false, package: 'no.kjapp.app', matchingClient: false, webClientIds: [], androidClients: [] };
try {
  const body = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8');
  const config = JSON.parse(body);
  const clients = (config.client || []).filter(c => c.client_info?.android_client_info?.package_name === google.package);
  google.readable = true;
  google.matchingClient = clients.length > 0;
  google.webClientIds = [...new Set(clients.flatMap(c => [...(c.oauth_client || []), ...(c.services?.appinvite_service?.other_platform_oauth_client || [])]).filter(c => c.client_type === 3).map(c => c.client_id).filter(id => /^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)))];
  google.androidClients = clients.flatMap(c => c.oauth_client || []).filter(c => c.client_type === 1 && c.android_info?.package_name === google.package).map(c => ({ clientId: c.client_id, certificateHash: c.android_info?.certificate_hash }));
} catch (_) {}
console.log('SNAR_GOOGLE_CONFIGURATION_METADATA ' + JSON.stringify(google));
const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
if (!token) { console.log('SNAR_MAPBOX_CONFIG ' + JSON.stringify({ tokenPresent: false, styleStatus: null })); }
else {
  const url = new URL('https://api.mapbox.com/styles/v1/mapbox/standard');
  url.searchParams.set('access_token', token);
  const req = https.get(url, response => {
    console.log('SNAR_MAPBOX_CONFIG ' + JSON.stringify({ tokenPresent: true, publicToken: token.startsWith('pk.'), styleStatus: response.statusCode }));
    response.resume();
  });
  req.on('error', () => console.log('SNAR_MAPBOX_CONFIG ' + JSON.stringify({ tokenPresent: true, styleStatus: null, networkError: true })));
  req.setTimeout(15000, () => req.destroy());
}
