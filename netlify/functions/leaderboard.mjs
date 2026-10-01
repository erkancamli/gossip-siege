// Gossip Siege leaderboard API (Netlify Functions v2 + Netlify Blobs).
//
//   POST /api/run     -> { id, ts, sig }   signed run ticket, requested when a run starts
//   GET  /api/scores  -> { rows: [...] }   top 50, best score per X handle
//   POST /api/scores  -> { ok, improved, rank, best }
//
// There are no accounts, so a determined cheater can still forge a score. The checks below
// stop the easy ways: a ticket signed by the server, a minimum real play time per wave,
// a score ceiling derived from the game's own scoring, one ticket per run, and a rate limit.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const BOARD_KEY = 'board/v1';
const KEEP = 200;            // rows kept in the board document
const SHOW = 50;             // rows returned to the page
const MAX_WAVE = 200;
const MIN_SECONDS_PER_WAVE = 4;   // the game needs about 18 game seconds per wave, 6 real seconds at 3x speed
const MAX_RUN_HOURS = 8;
const SUBMIT_GAP_MS = 8000;

// Measured with the game engine: a strong run scores about 230 x wave^2. 650 x wave^2 leaves
// a wide margin so no honest run is ever refused.
const scoreCeiling = (wave) => 650 * wave * wave + 3000;

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

async function readBoard(store) {
  const b = await store.get(BOARD_KEY, { type: 'json' });
  return b && Array.isArray(b.rows) ? b : { rows: [] };
}

// Core handler, separated from Netlify specifics so it can be tested locally.
export async function handle(req, { store, ip, secret, now = Date.now() }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (path.endsWith('/api/run')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const id = crypto.randomBytes(12).toString('base64url');
    return json({ id, ts: now, sig: sign(secret, id, now) });
  }

  if (!path.endsWith('/api/scores')) return json({ error: 'Not found.' }, 404);

  if (req.method === 'GET') {
    const b = await readBoard(store);
    return json({ rows: b.rows.slice(0, SHOW) }, 200, { 'cache-control': 'public, max-age=10' });
  }
  if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  const handle = cleanHandle(body.handle);
  if (!handle) return json({ error: 'Type your X handle (letters, numbers, underscore).' }, 400);
  const score = int(body.score), wave = int(body.wave), lives = int(body.lives);
  const decoded = Math.max(0, int(body.decoded) || 0), kills = Math.max(0, int(body.kills) || 0);
  if (!(score >= 0 && wave >= 1 && wave <= MAX_WAVE && lives >= 0 && lives <= 20)) return json({ error: 'That run does not look valid.' }, 400);

  // ticket
  const run = body.run || {};
  const ts = int(run.ts);
  if (!run.id || !Number.isFinite(ts) || !run.sig || !safeEqual(sign(secret, run.id, ts), run.sig)) {
    return json({ error: 'This run was not registered with the board. Play another run to submit.' }, 400);
  }
  const elapsed = (now - ts) / 1000;
  if (elapsed > MAX_RUN_HOURS * 3600) return json({ error: 'This run is too old to submit.' }, 400);
  if (elapsed < wave * MIN_SECONDS_PER_WAVE) return json({ error: 'That run finished faster than the game allows.' }, 400);
  if (score > scoreCeiling(wave)) return json({ error: 'That score is higher than the game can produce.' }, 400);

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
  const b = await readBoard(store);
  const key = handle.toLowerCase();
  const i = b.rows.findIndex((r) => r.handle.toLowerCase() === key);
  const prev = i >= 0 ? b.rows[i] : null;
  let improved = false;
  if (!prev || score > prev.score) {
    const row = { handle, score, wave, lives, decoded, kills, at: new Date(now).toISOString() };
    if (i >= 0) b.rows[i] = row; else b.rows.push(row);
    b.rows.sort((x, y) => y.score - x.score || y.wave - x.wave || x.at.localeCompare(y.at));
    b.rows = b.rows.slice(0, KEEP);
    await store.setJSON(BOARD_KEY, b);
    improved = true;
  }
  const rank = b.rows.findIndex((r) => r.handle.toLowerCase() === key) + 1;
  const best = rank ? b.rows[rank - 1].score : score;
  return json({ ok: true, improved, rank: rank || null, best });
}

export default async (req, context) => {
  const secret = (globalThis.Netlify && Netlify.env.get('RUN_SECRET')) || process.env.RUN_SECRET;
  if (!secret || secret.length < 16) return json({ error: 'The board is not configured yet (RUN_SECRET missing).' }, 503);
  const store = getStore({ name: 'gossip-siege', consistency: 'strong' });
  try {
    return await handle(req, { store, ip: context.ip, secret });
  } catch (e) {
    console.error(e);
    return json({ error: 'The board hit an error. Try again in a moment.' }, 500);
  }
};

export const config = { path: ['/api/run', '/api/scores'] };
