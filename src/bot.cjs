// Balance bot: plays the real engine on every stage and reports how far each strategy gets.
// node src/bot.cjs [stageId]
require('./stages.js'); require('./core.js'); const T = globalThis.TD;
const KINDS = ['spike', 'spike', 'blaze', 'moss', 'silk', 'cyan', 'sunny', 'blaze', 'spike', 'nova', 'silk', 'moss', 'cyan', 'nova', 'blaze', 'spike', 'silk'];
// share of each route a pad can reach, summed over routes, so a short route counts as much as a long one
function coverage(st, x, y) { let c = 0; for (const P of st.paths) { let cov = 0, len = 0; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); len += l; for (let u = 0; u < l; u += 8) if (Math.hypot(a[0] + (b[0] - a[0]) * u / l - x, a[1] + (b[1] - a[1]) * u / l - y) < 140) cov += 8; } c += cov / len; } return c; }
function planFor(st) { const order = st.pads.map((p, i) => [i, coverage(st, p[0], p[1])]).sort((a, b) => b[1] - a[1]).map(x => x[0]); return order.map((p, i) => [p, KINDS[i % KINDS.length]]); }
function play(stageId, seed, o = {}) {
  const g = T.newGame(seed, stageId); const dt = 1 / 30; T.startWave(g);
  const plan = planFor(g.stage), specOf = o.spec || {};
  while (!g.over && g.t < 7000 && !g.won) {
    for (let guard = 0; guard < 4; guard++) {
      const maxed = g.towers.every(t => t.lvl >= (o.maxLvl ?? 3));
      const next = (!o.cap || g.towers.length < o.cap || maxed) ? plan.find(([p, k]) => !g.pads[p].tower && g.unlocked[k]) : null;
      if (next && g.coins >= T.CREW[next[1]].cost[0]) { T.build(g, next[0], next[1]); continue; }
      if (o.upgrade !== false) {
        const u = g.towers.filter(t => t.lvl < (o.maxLvl ?? 3)).sort((a, b) => a.lvl - b.lvl)[0];
        if (u) { const sp = specOf[u.kind] || 'a'; const c = T.nextCost(u, sp); if ((!next || g.coins > c + T.CREW[next[1]].cost[0] * 0.6 || !g.unlocked[next[1]]) && g.coins >= c) { T.upgrade(g, u, sp); continue; } }
      }
      break;
    }
    if (o.burst && g.foes.length) { const e = g.foes.reduce((a, b) => a.d > b.d ? a : b); T.useBurst(g, e.x, e.y); }
    if (o.surge && g.foes.length > 15) T.useSurge(g);
    if (o.early && !g.waveActive && g.countdown != null && g.countdown < 15) T.startWave(g, true);
    T.update(g, dt); g.events.length = 0;
  }
  return { wave: g.wave, lives: g.lives, won: g.won, score: g.score, of: g.finalWave, l4: g.towers.filter(t => t.lvl === 3).length, n: g.towers.length };
}
const B = { spike: 'a', blaze: 'b', moss: 'b', silk: 'a', cyan: 'b', sunny: 'a', nova: 'b' };
const strategies = [
  ['passive', {}],
  ['active, no L4', { maxLvl: 2, burst: 1, surge: 1, early: 1 }],
    ['active, mixed', { spec: B, burst: 1, surge: 1, early: 1 }],
  ['focus 9, mixed', { spec: B, cap: 9, burst: 1, surge: 1, early: 1 }],
  ['focus 12, mixed', { spec: B, cap: 12, burst: 1, surge: 1, early: 1 }],
];
const only = process.argv[2] ? [Number(process.argv[2])] : T.STAGES.map(s => s.id);
for (const id of only) {
  const st = T.STAGES.find(s => s.id === id);
  console.log(`\n== Stage ${id} ${st.name} (${st.waves} waves, ${st.pads.length} pads, ${st.paths.length} path)`);
  for (const [n, o] of strategies) { const rs = [1, 2, 3, 4].map(s => play(id, s, o)); console.log(' ' + n.padEnd(16), rs.map(r => `w${r.wave}${r.won ? "W" : ""} L${r.lives} t${r.n}/${r.l4}`).join('  '), '| score', Math.round(rs.reduce((a, r) => a + r.score, 0) / 4)); }
}
