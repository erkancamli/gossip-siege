// The engine (src/core.js) and the server (leaderboard.mjs) each compute the daily stage; they must agree on every day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../netlify/functions/leaderboard.mjs', import.meta.url), 'utf8');
const m = src.match(/const dayIndex = [^\n]*\n[^\n]*\nconst DAILY_RANGES = [^\n]*\nconst dailyStage = [^\n]*/);
const serverStage = new Function(m[0] + '; return dailyStage;')();
globalThis.window = globalThis;
await import('../src/stages.js'); await import('../src/quiz.js'); await import('../src/core.js');
const T = globalThis.TD;

test('daily stage matches between engine and server for 3 years', () => {
  const combos = new Set();
  for (let k = 0; k < 1100; k++) {
    const day = new Date(Date.UTC(2026, 9, 1) + k * 86400000).toISOString().slice(0, 10);
    const d = T.dailyFor(day);
    assert.equal(d.stageId, serverStage(day), day);
    assert.ok(d.stageId >= d.mod.stages[0] && d.stageId <= d.mod.stages[1]);
    combos.add(d.mod.key + '@' + d.stageId);
  }
  const all = T.MODS.reduce((n, mod) => n + mod.stages[1] - mod.stages[0] + 1, 0);
  assert.equal(combos.size, all, 'every modifier visits each stage in its range');
});

test('a daily game applies its modifier and keeps the stage paths', () => {
  const d = T.dailyFor('2026-10-02');
  const g = T.newGame(d.seed, d.stageId, d.mod);
  assert.ok(Array.isArray(g.paths) && g.paths.length > 0);
  assert.equal(g.stage.id, d.stageId);
  assert.ok(g.stage.noKent === true || d.mod.key !== 'nobank');
  const g2 = T.newGame(d.seed, d.stageId, d.mod);
  assert.equal(g.rng.a, g2.rng.a, 'same seed, same rng state');
});
