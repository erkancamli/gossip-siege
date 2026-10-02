// Local stand-in for Netlify: serves dist/ and routes /api/* to the real handler with an in-memory store.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { handle } from '../netlify/functions/leaderboard.mjs';
const mem = new Map();
const store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
const debug = process.argv.includes('--debug');
const offset = { ms: 0 }; // lets the test fast-forward the server clock
// --debug: a stand in for Privy so the sign in flow can be exercised without X. Tokens look like "dev:<handle>".
const devPrivy = debug ? { appId: 'dev-app', clientId: 'dev-client', async verify(t) { if (!t.startsWith('dev:')) throw new Error('bad token'); return 'did:dev:' + t.slice(4); }, async xHandle(did) { const h = did.replace('did:dev:', ''); return h === 'nox' ? null : h; } } : null;
const FAKE_SDK = `window.PrivyCore = { LocalStorage: class {}, Privy: class { constructor(o) { this.cfg = o; this.auth = { oauth: { generateURL: async (prov, redirect) => redirect + '?privy_oauth_code=devcode&privy_oauth_state=devstate', loginWithCode: async (c, st) => { localStorage.setItem('dev_privy_user', 'tester_x'); return {}; } }, logout: async () => { localStorage.removeItem('dev_privy_user'); } }; this.user = { get: async () => { const h = localStorage.getItem('dev_privy_user'); return { user: h ? { id: 'did:dev:' + h, linked_accounts: [{ type: 'twitter_oauth', username: h }] } : null }; } }; } async initialize() {} async getAccessToken() { const h = localStorage.getItem('dev_privy_user'); return h ? 'dev:' + h : null; } } };`;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__clock') { offset.ms += Number(url.searchParams.get('add') || 0); res.end('ok'); return; }
  if (debug && url.pathname === '/privy.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(FAKE_SDK); return; }
  if (url.pathname.startsWith('/api/')) {
    const body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
    const r = await handle(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }), { store, ip: req.socket.remoteAddress, secret: 'dev-secret-0123456789abcdef', privy: devPrivy, now: Date.now() + offset.ms });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  const file = url.pathname === '/' ? 'dist/index.html' : 'dist' + url.pathname;
  try {
    let data = await readFile(file);
    if (debug && file.endsWith('index.html')) data = Buffer.from(data.toString().replace('fit(); toTitle();', 'window.__dbg = { get G() { return G; }, T, finish, newRun, showStages, get modalOpen(){return modalOpen;} }; window.__draw = { drawMascot, markAt }; fit(); toTitle();'));
    const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(8787, () => console.log('dev server on 8787'));
