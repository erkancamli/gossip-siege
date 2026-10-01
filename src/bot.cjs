// Balance bot: plays the real engine with a build order and reports how far it gets.
require('./core.js'); const T = globalThis.TD;
function play(seed, plan, o = {}) {
  const g = T.newGame(seed); const dt = 1 / 30; T.startWave(g);
  const specOf = o.spec || {};
  while (!g.over && g.t < 6000 && !g.won) {
    for (let guard = 0; guard < 4; guard++) {
      const next = plan.find(([p, k]) => !g.pads[p].tower && g.unlocked[k]);
      if (next && g.coins >= T.CREW[next[1]].cost[0]) { T.build(g, next[0], next[1]); continue; }
      if (o.upgrade !== false) {
        const cap = o.maxLvl ?? 3;
        const u = g.towers.filter(t => t.lvl < cap).sort((a, b) => a.lvl - b.lvl)[0];
        if (u) { const sp = specOf[u.kind] || 'a'; const c = T.nextCost(u, sp); if ((!next || g.coins > c + T.CREW[next[1]].cost[0] * 0.6 || !g.unlocked[next[1]]) && g.coins >= c) { T.upgrade(g, u, sp); continue; } }
      }
      break;
    }
    if (o.burst && g.foes.length) { const e = g.foes.reduce((a, b) => a.d > b.d ? a : b); T.useBurst(g, e.x, e.y); }
    if (o.surge && g.foes.length > 15) T.useSurge(g);
    if (o.early && !g.waveActive && g.countdown != null && g.countdown < 15) T.startWave(g, true);
    T.update(g, dt); g.events.length = 0;
  }
  return { wave: g.wave, lives: g.lives, won: g.won, score: g.score, decoded: g.stats.decoded, towers: g.towers.map(t => t.kind[0] + t.lvl + (t.spec || '')).join(' '),
    dmg: Object.fromEntries(T.CREW_ORDER.map(k => [k, Math.round(g.towers.filter(t => t.kind === k).reduce((a, t) => a + t.dmgDone, 0))])) };
}
const mixed = [[5, 'spike'], [1, 'spike'], [2, 'blaze'], [8, 'moss'], [10, 'silk'], [6, 'cyan'], [3, 'sunny'], [12, 'blaze'], [14, 'spike'], [11, 'nova'], [4, 'silk'], [9, 'moss'], [13, 'cyan'], [15, 'nova'], [7, 'blaze'], [0, 'spike']];
const spikeOnly = [5, 1, 2, 8, 10, 3, 6, 12, 14, 4, 11, 9, 13, 15, 7, 0].map(p => [p, 'spike']);
const A = Object.fromEntries(T.CREW_ORDER.map(k => [k, 'a'])), B = Object.fromEntries(T.CREW_ORDER.map(k => [k, 'b']));
const runs = [
  ['passive, no L4', mixed, { maxLvl: 2 }],
  ['passive, specs A', mixed, { spec: A }],
  ['passive, specs B', mixed, { spec: B }],
  ['active, specs A', mixed, { spec: A, burst: 1, surge: 1, early: 1 }],
  ['active, specs B', mixed, { spec: B, burst: 1, surge: 1, early: 1 }],
  ['spike only, A', spikeOnly, { spec: A }],
  ['no upgrades', mixed, { upgrade: false }],
  ['active, no L4', mixed, { maxLvl: 2, burst: 1, surge: 1, early: 1 }],
  ['active, mixed specs', mixed, { spec: { spike: 'a', blaze: 'b', moss: 'b', silk: 'a', cyan: 'b', sunny: 'a', nova: 'b' }, burst: 1, surge: 1, early: 1 }],
];
for (const [n, plan, o] of runs) {
  const rs = [1, 2, 3, 4].map(s => play(s, plan, o));
  console.log(n.padEnd(20), rs.map(r => `w${r.wave}${r.won ? 'W' : ''} L${r.lives}`).join('  '), '|', rs[0].towers);
}
if (process.argv[2] === 'dmg') for (const sp of [A, B]) console.log(JSON.stringify(play(1, mixed, { spec: sp, burst: 1, surge: 1, early: 1 }).dmg));
