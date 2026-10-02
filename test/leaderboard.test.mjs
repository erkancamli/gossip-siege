// Local tests for the leaderboard handler, with an in-memory stand-in for Netlify Blobs.
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, cleanHandle, resolveSecret } from '../netlify/functions/leaderboard.mjs';

const memStore = () => {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
  };
};
const SECRET = 'test-secret-0123456789abcdef';
const req = (method, path, body) => new Request('https://x.test' + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

async function ticket(env, now) { const r = await handle(req('POST', '/api/run'), { ...env, now }); return r.json(); }
// names are registered on first use per test store; the device key comes back from /api/register
const keys = new WeakMap();
async function register(env, h, now) {
  const r = await handle(req('POST', '/api/register', { handle: h }), { ...env, ip: env.ip + ':' + h, now }); const j = await r.json();
  if (r.status === 200) { const m = keys.get(env.store) || {}; m[j.handle.toLowerCase()] = j.key; keys.set(env.store, m); }
  return { status: r.status, body: j };
}
// submit as a registered name (registering it first when the store has not seen it)
async function submit(env, body, now) {
  const h = cleanHandle(body.handle); let m = keys.get(env.store) || {};
  if (!m[h.toLowerCase()]) { await register(env, h, now - 60_000); m = keys.get(env.store) || {}; }
  const r = await handle(req('POST', '/api/scores', { ...body, handle: h, key: m[h.toLowerCase()] }), { ...env, now }); return { status: r.status, body: await r.json() };
}

test('handle cleaning', () => {
  assert.equal(cleanHandle('@ekinoks_26'), 'ekinoks_26');
  assert.equal(cleanHandle(' <b>hi</b> there '), 'bhibthere');
  assert.equal(cleanHandle('a'.repeat(30)).length, 15);
});

test('valid run lands on the board and ranks', async () => {
  const env = { store: memStore(), ip: '1.1.1.1', secret: SECRET };
  const t0 = 1_000_000;
  const run = await ticket(env, t0);
  const r = await submit(env, { handle: '@Erkan', stage: 10, score: 279450, wave: 25, lives: 20, decoded: 200, run }, t0 + 25 * 60_000);
  assert.equal(r.status, 200); assert.equal(r.body.rank, 1); assert.equal(r.body.improved, true);
  const g = await handle(req('GET', '/api/scores?stage=10'), env); const rows = (await g.json()).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].handle, 'Erkan'); assert.equal(rows[0].score, 279450);
});

test('forged ticket is refused', async () => {
  const env = { store: memStore(), ip: '1.1.1.2', secret: SECRET };
  const run = await ticket(env, 0);
  const r = await submit(env, { handle: 'xyz', score: 100, wave: 1, lives: 20, run: { ...run, ts: run.ts - 999999 } }, 600_000);
  assert.equal(r.status, 400);
});

test('too fast and too high are refused', async () => {
  const env = { store: memStore(), ip: '1.1.1.3', secret: SECRET };
  const run = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'fast', stage: 10, score: 5000, wave: 25, lives: 20, run }, 30_000)).status, 400);
  const run2 = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'high', stage: 10, score: 9_999_999, wave: 25, lives: 20, run: run2 }, 3_600_000)).status, 400);
});

test('rate limit and best per handle', async () => {
  const env = { store: memStore(), ip: '1.1.1.4', secret: SECRET };
  const a = await ticket(env, 0), b = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'neo', score: 50000, wave: 12, lives: 18, run: a }, 900_000)).status, 200);
  assert.equal((await submit(env, { handle: 'neo', score: 20000, wave: 10, lives: 18, run: b }, 902_000)).status, 429);
  const r = await submit(env, { handle: 'NEO', score: 20000, wave: 10, lives: 18, run: b }, 920_000);
  assert.equal(r.status, 200); assert.equal(r.body.improved, false); assert.equal(r.body.best, 50000);
});

test('one ticket cannot be reused under another handle', async () => {
  const env = { store: memStore(), ip: '1.1.1.5', secret: SECRET };
  const a = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'one', score: 1000, wave: 3, lives: 20, run: a }, 600_000)).status, 200);
  assert.equal((await submit(env, { handle: 'two', score: 1000, wave: 3, lives: 20, run: a }, 700_000)).status, 409);
});

test('secret is generated once and reused when RUN_SECRET is not set', async () => {
  const store = memStore();
  const a = await resolveSecret(store, undefined);
  assert.ok(a.length >= 32);
  assert.equal((await store.get('config/secret')).v, a);
  assert.equal(await resolveSecret(store, 'env-secret-0123456789'), 'env-secret-0123456789');
});

test('each campaign stage has its own board and wave cap', async () => {
  const env = { store: memStore(), ip: '1.1.1.6', secret: SECRET };
  const a = await ticket(env, 0), b = await ticket(env, 0), c = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'blob', stage: 2, score: 50000, wave: 14, lives: 12, run: a }, 900_000)).status, 200);
  assert.equal((await submit(env, { handle: 'over', stage: 1, score: 9000, wave: 13, lives: 1, run: b }, 990_000)).status, 400); // stage 1 ends at 12
  // stage 2 allows 1.1x the stage 1 ceiling
  assert.equal((await submit(env, { handle: 'mult', stage: 2, score: Math.floor((650 * 14 * 14 + 3000) * 1.08), wave: 14, lives: 20, run: c }, 1_100_000)).status, 200);
  const s1 = (await (await handle(req('GET', '/api/scores?stage=1'), env)).json()).rows;
  const s2 = (await (await handle(req('GET', '/api/scores?stage=2'), env)).json()).rows;
  assert.equal(s1.length, 0); assert.deepEqual(s2.map((r) => r.handle), ['mult', 'blob']);
  const legacy = (await (await handle(req('GET', '/api/scores'), env)).json());
  assert.equal(legacy.stage, 1);
});

test('names are claimed once and posts need the device key', async () => {
  const env = { store: memStore(), ip: '1.1.1.7', secret: SECRET };
  const a = await register(env, '@Ekinoks_26', 0);
  assert.equal(a.status, 200); assert.equal(a.body.handle, 'Ekinoks_26'); assert.ok(a.body.key.length > 20);
  assert.equal((await register(env, 'ekinoks_26', 1)).status, 409); // same name, any case
  assert.equal((await register(env, 'ab', 2)).status, 400);         // too short
  assert.equal((await register(env, 'admin', 3)).status, 409);      // reserved
  const run = await ticket(env, 0);
  const noName = await handle(req('POST', '/api/scores', { stage: 1, score: 100, wave: 2, lives: 20, run }), { ...env, now: 600_000 });
  assert.equal(noName.status, 401);
  const unknown = await handle(req('POST', '/api/scores', { handle: 'nobody', key: 'x', stage: 1, score: 100, wave: 2, lives: 20, run }), { ...env, now: 600_000 });
  assert.equal(unknown.status, 401);
  const wrongKey = await handle(req('POST', '/api/scores', { handle: 'ekinoks_26', key: 'not-the-key', stage: 1, score: 100, wave: 2, lives: 20, run }), { ...env, now: 600_000 });
  assert.equal(wrongKey.status, 403);
  const ok = await handle(req('POST', '/api/scores', { handle: 'ekinoks_26', key: a.body.key, stage: 1, score: 100, wave: 2, lives: 20, run }), { ...env, now: 700_000 });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).handle, 'Ekinoks_26'); // the board shows the name as it was claimed
});

test('registration is rate limited per client', async () => {
  const env = { store: memStore(), ip: '1.1.1.8', secret: SECRET };
  assert.equal((await handle(req('POST', '/api/register', { handle: 'first' }), { ...env, now: 0 })).status, 200);
  assert.equal((await handle(req('POST', '/api/register', { handle: 'second' }), { ...env, now: 1000 })).status, 429);
  assert.equal((await handle(req('POST', '/api/register', { handle: 'second' }), { ...env, now: 20_000 })).status, 200);
});

test('overall board adds up the best score per stage for each name', async () => {
  const env = { store: memStore(), ip: '1.1.1.9', secret: SECRET };
  const a = await ticket(env, 0), b = await ticket(env, 0), c = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'ada', stage: 1, score: 30000, wave: 12, lives: 20, run: a }, 900_000)).status, 200);
  assert.equal((await submit(env, { handle: 'ada', stage: 2, score: 40000, wave: 14, lives: 20, run: b }, 1_800_000)).status, 200);
  assert.equal((await submit(env, { handle: 'bob', stage: 1, score: 50000, wave: 12, lives: 20, run: c }, 2_700_000)).status, 200);
  const all = await (await handle(req('GET', '/api/scores?stage=all'), env)).json();
  assert.equal(all.stage, 'all');
  assert.deepEqual(all.rows.map((r) => [r.handle, r.score, r.stages]), [['ada', 70000, 2], ['bob', 50000, 1]]);
});

test('daily challenge board and the weekly board', async () => {
  const env = { store: memStore(), ip: '1.1.1.10', secret: SECRET };
  const T0 = Date.UTC(2026, 9, 2, 12); // Friday 2026-10-02 12:00 UTC; the daily stage that day is 3 (dayIndex % 9)
  const a = await ticket(env, T0), b = await ticket(env, T0), c = await ticket(env, T0);
  const d1 = await submit(env, { handle: 'ada', stage: 'daily', day: '2026-10-02', score: 20000, wave: 15, lives: 20, run: a }, T0 + 1_200_000);
  assert.equal(d1.status, 200); assert.equal(d1.body.stage, 'daily'); assert.equal(d1.body.day, '2026-10-02');
  const old = await submit(env, { handle: 'ada', stage: 'daily', day: '2026-09-20', score: 100, wave: 2, lives: 20, run: b }, T0 + 1_300_000);
  assert.equal(old.status, 400);
  const tooHigh = await submit(env, { handle: 'ada', stage: 'daily', day: '2026-10-02', score: 9_000_000, wave: 15, lives: 20, run: b }, T0 + 1_400_000);
  assert.equal(tooHigh.status, 400); // the day's stage sets the ceiling
  const daily = await (await handle(req('GET', '/api/scores?stage=daily'), { ...env, now: T0 + 2_000_000 })).json();
  assert.equal(daily.day, '2026-10-02'); assert.equal(daily.dailyStage, 3); assert.deepEqual(daily.rows.map((r) => r.handle), ['ada']);
  // a campaign run counts for the week (Monday 2026-09-28), a daily run does not
  assert.equal((await submit(env, { handle: 'bob', stage: 2, score: 30000, wave: 14, lives: 20, run: c }, T0 + 1_500_000)).status, 200);
  const week = await (await handle(req('GET', '/api/scores?stage=week'), { ...env, now: T0 + 2_100_000 })).json();
  assert.equal(week.week, '2026-09-28'); assert.deepEqual(week.rows.map((r) => [r.handle, r.score]), [['bob', 30000]]);
  // next Monday the week board starts empty
  const next = await (await handle(req('GET', '/api/scores?stage=week'), { ...env, now: Date.UTC(2026, 9, 5, 1) })).json();
  assert.equal(next.week, '2026-10-05'); assert.equal(next.rows.length, 0);
});
