// Local tests for the leaderboard handler, with an in-memory stand-in for Netlify Blobs.
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, cleanHandle, resolveSecret, privyFromEnv } from '../netlify/functions/leaderboard.mjs';
import * as jose from 'jose';

const memStore = () => {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
  };
};
const SECRET = 'test-secret-0123456789abcdef';
// stand in for Privy: the bearer token is "did:<handle>", the X lookup returns that handle (null for "did:nox")
const fakePrivy = { appId: 'app', clientId: 'client', async verify(t) { if (!t.startsWith('did:')) throw new Error('bad'); return t; }, async xHandle(did) { const h = did.slice(4); return h === 'nox' ? null : h; } };
const req = (method, path, body, token) => new Request('https://x.test' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });

async function ticket(env, now) { const r = await handle(req('POST', '/api/run'), { ...env, now }); return r.json(); }
// submit as the X user named in body.handle (the stub turns it into a token); privy defaults to the stub
async function submit(env, body, now) { const { handle: h, ...rest } = body; const r = await handle(req('POST', '/api/scores', rest, 'did:' + cleanHandle(h)), { privy: fakePrivy, ...env, now }); return { status: r.status, body: await r.json() }; }

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
  const r = await submit(env, { handle: 'x', score: 100, wave: 1, lives: 20, run: { ...run, ts: run.ts - 999999 } }, 600_000);
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

test('scores need an X sign in through Privy', async () => {
  const env = { store: memStore(), ip: '1.1.1.7', secret: SECRET };
  const run = await ticket(env, 0);
  const noAuth = await handle(req('POST', '/api/scores', { stage: 1, score: 100, wave: 2, lives: 20, run }), { ...env, privy: fakePrivy, now: 600_000 });
  assert.equal(noAuth.status, 401);
  const badTok = await handle(req('POST', '/api/scores', { stage: 1, score: 100, wave: 2, lives: 20, run }, 'garbage'), { ...env, privy: fakePrivy, now: 600_000 });
  assert.equal(badTok.status, 401);
  const noX = await handle(req('POST', '/api/scores', { stage: 1, score: 100, wave: 2, lives: 20, run }, 'did:nox'), { ...env, privy: fakePrivy, now: 600_000 });
  assert.equal(noX.status, 403);
  const notSetUp = await handle(req('POST', '/api/scores', { stage: 1, score: 100, wave: 2, lives: 20, run }, 'did:ok'), { ...env, privy: null, now: 600_000 });
  assert.equal(notSetUp.status, 503);
  const ok = await submit(env, { handle: 'ekinoks_26', stage: 1, score: 100, wave: 2, lives: 20, run }, 700_000);
  assert.equal(ok.status, 200); assert.equal(ok.body.handle, 'ekinoks_26');
  const cfg = await (await handle(req('GET', '/api/privy'), { ...env, privy: fakePrivy })).json();
  assert.deepEqual(cfg, { appId: 'app', clientId: 'client' });
});

test('real Privy style tokens verify with the ES256 key and reject the wrong app', async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
  const spki = await jose.exportSPKI(publicKey);
  const calls = [];
  const privy = privyFromEnv({ PRIVY_APP_ID: 'app123', PRIVY_APP_SECRET: 'sec', PRIVY_VERIFICATION_KEY: spki, PRIVY_CLIENT_ID: 'c1' });
  const mint = (aud) => new jose.SignJWT({ sid: 's' }).setProtectedHeader({ alg: 'ES256' }).setIssuer('privy.io').setAudience(aud).setSubject('did:privy:abc').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  assert.equal(await privy.verify(await mint('app123')), 'did:privy:abc');
  await assert.rejects(privy.verify(await mint('other-app')));
  assert.equal(privyFromEnv({}), null);
});
