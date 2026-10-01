// Local tests for the leaderboard handler, with an in-memory stand-in for Netlify Blobs.
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, cleanHandle } from '../netlify/functions/leaderboard.mjs';

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
async function submit(env, body, now) { const r = await handle(req('POST', '/api/scores', body), { ...env, now }); return { status: r.status, body: await r.json() }; }

test('handle cleaning', () => {
  assert.equal(cleanHandle('@ekinoks_26'), 'ekinoks_26');
  assert.equal(cleanHandle(' <b>hi</b> there '), 'bhibthere');
  assert.equal(cleanHandle('a'.repeat(30)).length, 15);
});

test('valid run lands on the board and ranks', async () => {
  const env = { store: memStore(), ip: '1.1.1.1', secret: SECRET };
  const t0 = 1_000_000;
  const run = await ticket(env, t0);
  const r = await submit(env, { handle: '@Erkan', score: 139725, wave: 25, lives: 20, decoded: 200, run }, t0 + 25 * 60_000);
  assert.equal(r.status, 200); assert.equal(r.body.rank, 1); assert.equal(r.body.improved, true);
  const g = await handle(req('GET', '/api/scores'), env); const rows = (await g.json()).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].handle, 'Erkan'); assert.equal(rows[0].score, 139725);
});

test('forged ticket is refused', async () => {
  const env = { store: memStore(), ip: '1.1.1.2', secret: SECRET };
  const run = await ticket(env, 0);
  const r = await submit(env, { handle: 'x', score: 100, wave: 1, lives: 20, run: { ...run, ts: run.ts - 999999 } }, 600_000);
  assert.equal(r.status, 400);
});

test('too fast and too high are refused', async () => {
  const env = { store: memStore(), ip: '1.1.1.3', secret: SECRET };
  const run = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'fast', score: 5000, wave: 25, lives: 20, run }, 30_000)).status, 400);
  const run2 = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'high', score: 9_999_999, wave: 25, lives: 20, run: run2 }, 3_600_000)).status, 400);
});

test('rate limit and best per handle', async () => {
  const env = { store: memStore(), ip: '1.1.1.4', secret: SECRET };
  const a = await ticket(env, 0), b = await ticket(env, 0);
  assert.equal((await submit(env, { handle: 'neo', score: 50000, wave: 15, lives: 18, run: a }, 900_000)).status, 200);
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
