// Gossip Siege leaderboard API (Netlify Functions v2 + Netlify Blobs).
//
//   POST /api/run     -> { id, ts, sig }   signed run ticket, requested when a run starts
//   GET  /api/scores?stage=n -> { rows: [...] }   top 50 of that campaign stage, best score per X handle
//   POST /api/scores  -> { ok, improved, rank, best }   needs a Privy access token (X login); the handle comes from X
//   GET  /api/privy   -> { appId, clientId }   public sign in config, empty when sign in is not configured
//
// There are no accounts, so a determined cheater can still forge a score. The checks below
// stop the easy ways: a ticket signed by the server, a minimum real play time per wave,
// a score ceiling derived from the game's own scoring, one ticket per run, and a rate limit.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import * as jose from 'jose';

// Campaign stages: waves to clear and the score multiplier the game applies (src/stages.js).
// Hoodi, Blob Season, Subsea Cable and Mainnet keep their earlier board keys so scores stay.
// The ceiling also leaves room for quiz points (at most about 300 x multiplier per question).
export const STAGES = {
  1: { key: 'board/v1', waves: 12, mult: 1.0, endless: false },   // Hoodi Testnet
  2: { key: 'board/flood', waves: 14, mult: 1.1, endless: false },  // Copy Storm
  3: { key: 'board/shard', waves: 15, mult: 1.2, endless: false },  // Shard Threshold
  4: { key: 'board/s2', waves: 16, mult: 1.3, endless: false },     // Blob Season (kept from the 4 stage campaign)
  5: { key: 'board/mesh', waves: 17, mult: 1.4, endless: false },   // Mesh Limits
  6: { key: 'board/s3', waves: 18, mult: 1.5, endless: false },     // Subsea Cable (kept)
  7: { key: 'board/flex', waves: 19, mult: 1.6, endless: false },   // Flexnode Grid
  8: { key: 'board/gateway', waves: 20, mult: 1.7, endless: false }, // The Gateway
  9: { key: 'board/stress', waves: 22, mult: 1.85, endless: false }, // Stress Test
  10: { key: 'board/s4', waves: 25, mult: 2.0, endless: true },     // Mainnet (kept)
};
const stageOf = (v) => STAGES[int(v)] ? int(v) : 1;
const KEEP = 200;            // rows kept in the board document
const SHOW = 50;             // rows returned to the page
const MAX_WAVE = 200;
const MIN_SECONDS_PER_WAVE = 4;   // the game needs about 18 game seconds per wave, 6 real seconds at 3x speed
const MAX_RUN_HOURS = 8;
const SUBMIT_GAP_MS = 8000;

// Measured with the game engine: a strong run scores about 230 x wave^2. 650 x wave^2 leaves
// a wide margin so no honest run is ever refused.
const scoreCeiling = (wave, mult = 1) => (650 * wave * wave + 3000 + 300 * Math.ceil(wave / 2)) * mult;

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

export function cleanHandle(v) {
  return String(v || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
}
const sign = (secret, id, ts) => crypto.createHmac('sha256', secret).update(`${id}.${ts}`).digest('base64url');
const hashIp = (secret, ip) => crypto.createHmac('sha256', secret).update(`ip:${ip || 'unknown'}`).digest('base64url').slice(0, 22);
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const int = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);

async function readBoard(store, key) {
  const b = await store.get(key, { type: 'json' });
  return b && Array.isArray(b.rows) ? b : { rows: [] };
}

// Sign in: players log in with X through Privy. The page sends the Privy access token (an ES256 JWT), the server
// checks its signature with the app's verification key and reads the X username from Privy's user API, so the
// handle on the board is always the real X account. `privy` is injected so tests can stub it.
export function privyFromEnv(env) {
  const appId = env.PRIVY_APP_ID, appSecret = env.PRIVY_APP_SECRET, key = env.PRIVY_VERIFICATION_KEY;
  if (!appId || !appSecret || !key) return null;
  const pem = key.includes('BEGIN') ? key.replace(/\\n/g, '\n') : `-----BEGIN PUBLIC KEY-----\n${key.replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
  let pub = null;
  return {
    appId, clientId: env.PRIVY_CLIENT_ID || '',
    async verify(token) {
      pub = pub || await jose.importSPKI(pem, 'ES256');
      const { payload } = await jose.jwtVerify(token, pub, { issuer: 'privy.io', audience: appId });
      return payload.sub;
    },
    async xHandle(did) {
      const r = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, { headers: { Authorization: 'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64'), 'privy-app-id': appId } });
      if (!r.ok) throw new Error('privy user lookup failed: ' + r.status);
      const u = await r.json();
      const tw = (u.linked_accounts || []).find((a) => a.type === 'twitter_oauth');
      return tw && tw.username ? tw.username : null;
    },
  };
}
const HANDLE_CACHE_MS = 24 * 3600 * 1000;

// Core handler, separated from Netlify specifics so it can be tested locally.
export async function handle(req, { store, ip, secret, privy = null, now = Date.now() }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (path.endsWith('/api/privy')) return json(privy ? { appId: privy.appId, clientId: privy.clientId } : {}, 200, { 'cache-control': 'public, max-age=300' });

  if (path.endsWith('/api/run')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const id = crypto.randomBytes(12).toString('base64url');
    return json({ id, ts: now, sig: sign(secret, id, now) });
  }

  if (!path.endsWith('/api/scores')) return json({ error: 'Not found.' }, 404);

  if (req.method === 'GET') {
    const st = stageOf(url.searchParams.get('stage'));
    const b = await readBoard(store, STAGES[st].key);
    return json({ stage: st, rows: b.rows.slice(0, SHOW) }, 200, { 'cache-control': 'no-store' });
  }
  if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  // who is posting: the X account behind the Privy token
  if (!privy) return json({ error: 'Sign in with X is not set up on this board yet.' }, 503);
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'Sign in with X to post your score.' }, 401);
  let did;
  try { did = await privy.verify(token); } catch { return json({ error: 'Your sign in expired. Sign in with X again.' }, 401); }
  const hKey = `privy/${crypto.createHash('sha256').update(did).digest('base64url').slice(0, 24)}`;
  let cached = await store.get(hKey, { type: 'json' });
  if (!cached || now - cached.at > HANDLE_CACHE_MS) {
    let h = null;
    try { h = await privy.xHandle(did); } catch { if (cached) h = cached.handle; else return json({ error: 'Could not read your X account. Try again in a moment.' }, 502); }
    cached = { handle: h, at: now }; await store.setJSON(hKey, cached);
  }
  const handle = cleanHandle(cached.handle);
  if (!handle) return json({ error: 'Connect an X account to post scores.' }, 403);
  const score = int(body.score), wave = int(body.wave), lives = int(body.lives);
  const decoded = Math.max(0, int(body.decoded) || 0), kills = Math.max(0, int(body.kills) || 0);
  const st = stageOf(body.stage), S = STAGES[st];
  const maxWave = S.endless ? MAX_WAVE : S.waves;
  if (!(score >= 0 && wave >= 1 && wave <= maxWave && lives >= 0 && lives <= 20)) return json({ error: 'That run does not look valid.' }, 400);

  // ticket
  const run = body.run || {};
  const ts = int(run.ts);
  if (!run.id || !Number.isFinite(ts) || !run.sig || !safeEqual(sign(secret, run.id, ts), run.sig)) {
    return json({ error: 'This run was not registered with the board. Play another run to submit.' }, 400);
  }
  const elapsed = (now - ts) / 1000;
  if (elapsed > MAX_RUN_HOURS * 3600) return json({ error: 'This run is too old to submit.' }, 400);
  if (elapsed < wave * MIN_SECONDS_PER_WAVE) return json({ error: 'That run finished faster than the game allows.' }, 400);
  if (score > scoreCeiling(wave, S.mult)) return json({ error: 'That score is higher than the game can produce.' }, 400);

  // rate limit per client
  const rlKey = `rl/${hashIp(secret, ip)}`;
  const last = await store.get(rlKey, { type: 'json' });
  if (last && now - last.at < SUBMIT_GAP_MS) return json({ error: 'Slow down a little, then try again.' }, 429);
  await store.setJSON(rlKey, { at: now });

  // one ticket, one handle
  const runKey = `run/${run.id}`;
  const used = await store.get(runKey, { type: 'json' });
  if (used && used.handle !== handle.toLowerCase()) return json({ error: 'This run was already submitted under another handle.' }, 409);
  if (!used) await store.setJSON(runKey, { handle: handle.toLowerCase(), at: now });

  // best per handle
  const b = await readBoard(store, S.key);
  const key = handle.toLowerCase();
  const i = b.rows.findIndex((r) => r.handle.toLowerCase() === key);
  const prev = i >= 0 ? b.rows[i] : null;
  let improved = false;
  if (!prev || score > prev.score) {
    const row = { handle, score, wave, lives, decoded, kills, at: new Date(now).toISOString() };
    if (i >= 0) b.rows[i] = row; else b.rows.push(row);
    b.rows.sort((x, y) => y.score - x.score || y.wave - x.wave || x.at.localeCompare(y.at));
    b.rows = b.rows.slice(0, KEEP);
    await store.setJSON(S.key, b);
    improved = true;
  }
  const rank = b.rows.findIndex((r) => r.handle.toLowerCase() === key) + 1;
  const best = rank ? b.rows[rank - 1].score : score;
  return json({ ok: true, stage: st, handle, improved, rank: rank || null, best });
}

// The signing secret comes from RUN_SECRET when it is set. Otherwise one is generated on first use
// and kept in the site's own blob store, which is private to the site, so no setup is needed.
let cachedSecret = null;
export async function resolveSecret(store, envSecret) {
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (cachedSecret) return cachedSecret;
  const saved = await store.get('config/secret', { type: 'json' });
  if (saved && typeof saved.v === 'string' && saved.v.length >= 32) return (cachedSecret = saved.v);
  const v = crypto.randomBytes(32).toString('base64url');
  await store.setJSON('config/secret', { v, at: Date.now() });
  const again = await store.get('config/secret', { type: 'json' }); // two cold starts racing: keep whichever landed
  return (cachedSecret = (again && again.v) || v);
}

export default async (req, context) => {
  const store = getStore({ name: 'gossip-siege', consistency: 'strong' });
  try {
    const env = (k) => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k];
    const secret = await resolveSecret(store, env('RUN_SECRET'));
    const privy = privyFromEnv({ PRIVY_APP_ID: env('PRIVY_APP_ID'), PRIVY_APP_SECRET: env('PRIVY_APP_SECRET'), PRIVY_VERIFICATION_KEY: env('PRIVY_VERIFICATION_KEY'), PRIVY_CLIENT_ID: env('PRIVY_CLIENT_ID') });
    return await handle(req, { store, ip: context.ip, secret, privy });
  } catch (e) {
    console.error(e);
    return json({ error: 'The board hit an error. Try again in a moment.' }, 500);
  }
};

export const config = { path: ['/api/run', '/api/scores', '/api/privy'] };
