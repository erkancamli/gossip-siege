// Gossip Siege core: rules, waves, combat. Pure JS, no DOM, deterministic with a seed.
// The RLNC idea lives in the "coded shield": an armored enemy only cracks after hits from k
// DIFFERENT crew members (independent shards). Repeat hits from one tower are redundant,
// unless a Recoder aura re-mixes them into fresh shards.
(function (root) {
  'use strict';
  const W = 1280, H = 720;
  const PATH = [[-40, 170], [260, 170], [260, 500], [520, 500], [520, 250], [800, 250], [800, 560], [1060, 560], [1060, 330], [1320, 330]];
  const PADS = [[700, 455], [170, 262], [352, 300], [170, 430], [390, 592], [390, 410], [430, 250], [640, 160], [610, 380], [930, 640], [890, 430], [970, 330], [1150, 450], [1170, 245], [710, 560], [1230, 420]];

  // ---------- path ----------
  const SEG = []; let PATH_LEN = 0;
  for (let i = 0; i < PATH.length - 1; i++) { const a = PATH[i], b = PATH[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); SEG.push({ a, b, L, d0: PATH_LEN }); PATH_LEN += L; }
  const END_D = PATH_LEN - 90;
  function posAt(d) {
    d = Math.max(0, Math.min(PATH_LEN, d));
    for (const s of SEG) if (d <= s.d0 + s.L) { const t = (d - s.d0) / s.L; return { x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t, dx: (s.b[0] - s.a[0]) / s.L, dy: (s.b[1] - s.a[1]) / s.L }; }
    const s = SEG[SEG.length - 1]; return { x: s.b[0], y: s.b[1], dx: 1, dy: 0 };
  }

  function rng32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- crew (towers) ----------
  // Levels 1 to 3 are linear (lv[0..2]). At level 4 each crew member specializes into one of
  // two very different weapons (specs.a / specs.b), the Kingdom Rush pattern. Every level makes
  // the weapon visibly bigger and stronger; the renderer reads t.lvl and t.spec for that.
  const CREW = {
    spike: { name: 'Spike', role: 'Encoder', unlock: 1, look: { visor: '#9b7bff', hair: 'spiky', hairColor: '#f4f6f8', jacket: '#101216' },
      blurb: 'Cuts every block into coded shards and fires them fast. Cheap, reliable, the backbone of any mesh.',
      cost: [70, 95, 170],
      lv: [{ dmg: 8, rate: 2.0, range: 130, shots: 1 }, { dmg: 13, rate: 2.5, range: 140, shots: 1 }, { dmg: 17, rate: 2.8, range: 150, shots: 2 }],
      specs: {
        a: { name: 'Fountain Coder', cost: 330, blurb: 'A fountain code never repeats itself: every single shard counts as a fresh independent shard, so coded shields melt.', st: { dmg: 22, rate: 3.4, range: 165, shots: 3, fresh: true } },
        b: { name: 'Railshard', cost: 350, blurb: 'Compresses the whole block into one rail shot that pierces up to 6 enemies in a line and ignores armor.', st: { dmg: 70, rate: 1.5, range: 190, rail: 6 } },
      } },
    blaze: { name: 'Blaze', role: 'Flood Breaker', unlock: 1, look: { visor: '#ff5a4e', hair: 'spiky', hairColor: '#e2453c', jacket: '#101216' },
      blurb: 'Slams the ground with a burst that clears whole swarms. Built for duplicate floods.',
      cost: [110, 135, 210],
      lv: [{ dmg: 16, rate: 0.85, range: 115, splash: 55 }, { dmg: 27, rate: 0.95, range: 122, splash: 63 }, { dmg: 40, rate: 1.05, range: 132, splash: 74, knock: 22 }],
      specs: {
        a: { name: 'Cluster Flood', cost: 390, blurb: 'Every blast splits into four bomblets that scatter along the path. Dupe swarms vanish.', st: { dmg: 46, rate: 1.1, range: 140, splash: 74, knock: 22, cluster: 4 } },
        b: { name: 'Firewall', cost: 370, blurb: 'Leaves a burning firewall on the path for 3 seconds. Nothing that walks through it comes out healthy.', st: { dmg: 42, rate: 1.0, range: 140, splash: 78, fire: { dps: 34, dur: 3, r: 62 } } },
      } },
    moss: { name: 'Moss', role: 'Throttle', unlock: 1, look: { visor: '#7bdc6a', hair: 'curly', hairColor: '#6b4a2e', jacket: '#1d3a22' },
      blurb: 'Pulses a rate limit that slows everything nearby and exposes hidden attackers.',
      cost: [90, 115, 175],
      lv: [{ slow: 0.35, range: 110 }, { slow: 0.45, range: 122 }, { slow: 0.55, range: 136, dot: 12 }],
      specs: {
        a: { name: 'Rate Limiter', cost: 310, blurb: 'Every fourth pulse is a hard rate limit: everything in range freezes for a second.', st: { slow: 0.62, range: 152, dot: 18, stun: 0.9 } },
        b: { name: 'Peer Scoring', cost: 330, blurb: 'Marks every enemy in range as a bad peer. Marked enemies take 35% more damage from the whole crew.', st: { slow: 0.55, range: 158, dot: 14, mark: 0.35 } },
      } },
    silk: { name: 'Silk', role: 'Long Haul', unlock: 1, look: { visor: '#ff8fd0', hair: 'long', hairColor: '#d9dde3', jacket: '#101216' },
      blurb: 'Sends one heavy shard across the whole map. Punches through armor from level 2.',
      cost: [120, 145, 230],
      lv: [{ dmg: 50, rate: 0.55, range: 250 }, { dmg: 82, rate: 0.62, range: 275, pierce: true }, { dmg: 122, rate: 0.7, range: 305, pierce: true, crit: 0.25 }],
      specs: {
        a: { name: 'Global Relay', cost: 430, blurb: 'Reaches every corner of the map. Huge shots, 40% chance to crit for triple damage.', st: { dmg: 270, rate: 0.62, range: 2000, pierce: true, crit: 0.4, critX: 3 } },
        b: { name: 'Shrapnel Lance', cost: 410, blurb: 'The lance bursts on impact into six fragments that hit everything around the target.', st: { dmg: 155, rate: 0.78, range: 315, pierce: true, crit: 0.25, shrapnel: { n: 6, dmg: 36, r: 95 } } },
      } },
    cyan: { name: 'Cyan', role: 'Recoder', unlock: 5, look: { visor: '#4dd8ff', hair: 'bald', hairColor: '', jacket: '#0f1d2a' },
      blurb: 'Re-mixes the shards of every crew member nearby into fresh combinations, so their hits always count as new. Also speeds them up.',
      cost: [100, 125, 185],
      lv: [{ buff: 0.25, dmg: 5, rate: 1.2, range: 120 }, { buff: 0.4, dmg: 8, rate: 1.4, range: 135 }, { buff: 0.55, dmg: 12, rate: 1.6, range: 150 }],
      specs: {
        a: { name: 'Mesh Amplifier', cost: 350, blurb: 'A much larger recoding aura that makes nearby crew fire 85% faster.', st: { buff: 0.85, dmg: 14, rate: 1.8, range: 190 } },
        b: { name: 'Chain Recoder', cost: 330, blurb: 'Its zap jumps across five enemies, and every jump lands as a fresh independent shard.', st: { buff: 0.55, dmg: 28, rate: 1.8, range: 162, chain: 5 } },
      } },
    sunny: { name: 'Sunny', role: 'Flexnode Bank', unlock: 5, look: { visor: '#ffd23f', hair: 'bun', hairColor: '#f2c230', jacket: '#101216' },
      blurb: 'Rents out spare bandwidth. Pays out after every wave, plus interest on your savings. Speed is money.',
      cost: [125, 150, 225],
      lv: [{ income: 25, interest: 0 }, { income: 45, interest: 0.03 }, { income: 70, interest: 0.06 }],
      specs: {
        a: { name: 'Validator Fund', cost: 390, blurb: 'A full staking desk: 130 coins every wave plus 8% interest on savings.', st: { income: 130, interest: 0.08 } },
        b: { name: 'MEV Hunter', cost: 370, blurb: 'Throws gold at enemies, and every kill anywhere in its range pays 3 extra coins.', st: { income: 70, interest: 0.03, range: 155, dmg: 26, rate: 1.6, bonus: 3 } },
      } },
    nova: { name: 'Nova', role: 'Decoder', unlock: 8, look: { visor: '#4da3ff', hair: 'bald', hairColor: '', jacket: '#e9ecef' },
      blurb: 'A visor beam that heats up on one target. Instantly decodes anything left with a sliver of health, and hits decoded armor twice as hard.',
      cost: [150, 175, 265],
      lv: [{ dps: 26, range: 140, exec: 0.12 }, { dps: 40, range: 152, exec: 0.15 }, { dps: 62, range: 168, exec: 0.2 }],
      specs: {
        a: { name: 'Decode Ray', cost: 470, blurb: 'The beam no longer stops at one target: it burns through everything in a straight line.', st: { dps: 92, range: 195, exec: 0.22, line: true } },
        b: { name: 'Twin Decoder', cost: 450, blurb: 'Two beams on two targets, heating up twice as fast. Decodes anything under 30% health.', st: { dps: 72, range: 178, exec: 0.3, beams: 2, heat: 2 } },
      } },
  };
  const CREW_ORDER = ['spike', 'blaze', 'moss', 'silk', 'cyan', 'sunny', 'nova'];
  const MAX_LVL = 3; // 0..2 linear, 3 = specialized
  const stat = (t) => (t.lvl >= MAX_LVL ? CREW[t.kind].specs[t.spec].st : CREW[t.kind].lv[t.lvl]);
  const statAt = (kind, lvl, spec) => (lvl >= MAX_LVL ? CREW[kind].specs[spec].st : CREW[kind].lv[lvl]);
  function nextCost(t, spec) { if (!t || t.lvl >= MAX_LVL) return Infinity; if (t.lvl === MAX_LVL - 1) return CREW[t.kind].specs[spec || 'a'].cost; return CREW[t.kind].cost[t.lvl + 1]; }
  const PRIOS = ['first', 'last', 'strong', 'close'];

  // ---------- enemies ----------
  const FOES = {
    lag: { name: 'Lag Slug', hp: 70, spd: 40, bounty: 6, lives: 1, r: 18, blurb: 'Latency itself. Slow, stubborn and thick. Every millisecond it survives is money lost.' },
    gremlin: { name: 'Packet Gremlin', hp: 34, spd: 86, bounty: 5, lives: 1, r: 13, blink: 3.0, blurb: 'Packet loss with legs. It vanishes and pops up further down the line. Slow it before it skips past.' },
    dupe: { name: 'Dupe', hp: 16, spd: 72, bounty: 2, lives: 1, r: 10, blurb: 'Gossipsub sends whole copies of a block to every peer, so most arrivals are duplicates. They come in swarms: splash them.' },
    hog: { name: 'Bandwidth Hog', hp: 260, spd: 30, bounty: 20, lives: 2, r: 24, armor: 7, blurb: 'Eats bandwidth for breakfast. Armor shrugs off weak hits; bring Silk or heavy splash.' },
    phantom: { name: 'Eclipse Phantom', hp: 80, spd: 58, bounty: 10, lives: 1, r: 15, invis: true, blurb: 'Tries to cut validators off from honest peers. Invisible until Moss exposes it or something hits it.' },
    boss: { name: 'Gossip Blob', hp: 1300, spd: 18, bounty: 250, lives: 6, r: 44, armor: 3, boss: true, blurb: 'Every redundant copy the network ever sent, fused into one. It leaks Dupes as it takes damage.' },
  };

  // waves 1..25. Each group: [type, count, gap seconds, start delay, shieldK]
  const WAVES = [
    [['lag', 6, 1.2, 0]],
    [['lag', 8, 1.0, 0], ['gremlin', 4, 0.9, 6]],
    [['dupe', 14, 0.35, 0], ['lag', 5, 1.1, 4]],
    [['gremlin', 10, 0.7, 0], ['lag', 6, 1.0, 3]],
    [['hog', 2, 4, 0], ['dupe', 18, 0.3, 2], ['lag', 6, 0.9, 6]],
    [['lag', 10, 0.8, 0], ['gremlin', 10, 0.55, 4], ['hog', 2, 3, 9]],
    [['dupe', 30, 0.22, 0], ['hog', 3, 3, 4]],
    [['lag', 8, 0.9, 0, 2], ['gremlin', 10, 0.5, 3], ['lag', 6, 0.9, 8]],
    [['hog', 4, 2.5, 0, 2], ['dupe', 24, 0.25, 3], ['gremlin', 8, 0.5, 8]],
    [['lag', 10, 0.7, 0], ['boss', 1, 1, 6]],
    [['gremlin', 18, 0.4, 0], ['hog', 4, 2.2, 4, 2], ['dupe', 20, 0.22, 9]],
    [['lag', 14, 0.6, 0, 2], ['hog', 5, 2.0, 5], ['gremlin', 12, 0.4, 9]],
    [['phantom', 8, 1.0, 0], ['lag', 10, 0.7, 2], ['dupe', 30, 0.18, 7]],
    [['hog', 7, 1.6, 0, 2], ['phantom', 8, 0.9, 5], ['gremlin', 16, 0.35, 9]],
    [['dupe', 50, 0.13, 0], ['lag', 14, 0.55, 5, 2], ['phantom', 8, 0.8, 9]],
    [['hog', 6, 1.6, 0, 3], ['gremlin', 20, 0.3, 4], ['lag', 12, 0.5, 9, 3]],
    [['phantom', 14, 0.6, 0], ['hog', 6, 1.4, 4, 2], ['dupe', 40, 0.14, 8]],
    [['lag', 20, 0.45, 0, 3], ['gremlin', 24, 0.28, 6], ['hog', 6, 1.3, 10, 3]],
    [['dupe', 60, 0.1, 0], ['phantom', 14, 0.5, 4], ['hog', 8, 1.2, 8, 2]],
    [['hog', 6, 1.4, 0, 3], ['boss', 1, 1, 5], ['dupe', 30, 0.15, 10]],
    [['gremlin', 30, 0.22, 0], ['lag', 20, 0.4, 5, 3], ['phantom', 14, 0.5, 10]],
    [['hog', 12, 0.9, 0, 3], ['dupe', 60, 0.1, 4], ['gremlin', 20, 0.25, 9]],
    [['phantom', 20, 0.4, 0], ['lag', 24, 0.35, 4, 3], ['hog', 10, 0.9, 9, 3]],
    [['dupe', 80, 0.08, 0], ['hog', 12, 0.8, 4, 3], ['gremlin', 30, 0.2, 8], ['phantom', 16, 0.4, 12]],
    [['hog', 8, 1.0, 0, 3], ['boss', 1, 1, 4, 4], ['boss', 1, 1, 22, 4], ['dupe', 40, 0.12, 12]],
  ];
  const FINAL_WAVE = WAVES.length;
  function hpMult(w) { return 1 + 0.1 * (w - 1) + 0.028 * (w - 1) * (w - 1) + (w > 14 ? 0.6 * (w - 14) * (w - 14) : 0); }
  function endlessWave(w, rng) {
    const types = ['lag', 'gremlin', 'dupe', 'hog', 'phantom'], g = [];
    for (let i = 0; i < 4; i++) { const t = types[Math.floor(rng() * types.length)]; const n = t === 'dupe' ? 60 : t === 'hog' ? 10 : 22; g.push([t, n, t === 'dupe' ? 0.09 : 0.35, i * 4, rng() < 0.6 ? 3 + Math.floor(rng() * 2) : 0]); }
    if (w % 5 === 0) g.push(['boss', 1 + Math.floor((w - 25) / 10), 6, 6, 4]);
    return g;
  }

  // ---------- game ----------
  function newGame(seed) {
    const g = {
      seed, rng: rng32(seed || 1), t: 0, coins: 220, lives: 20, maxLives: 20, wave: 0, score: 0, state: 'build',
      towers: [], foes: [], shots: [], fx: [], events: [], zones: [], pads: PADS.map((p, i) => ({ i, x: p[0], y: p[1], tower: null })),
      spawnQ: [], waveActive: false, countdown: null, nextId: 1, tokenSeq: 0, leaksThisWave: 0, stats: { kills: 0, leaks: 0, early: 0, decoded: 0, bossKills: 0, spent: 0 },
      abilities: { burst: { cd: 30, left: 0 }, surge: { cd: 45, left: 0, active: 0 } }, seenFoes: {}, unlocked: {}, over: false, won: false,
    };
    CREW_ORDER.forEach(k => { if (CREW[k].unlock <= 1) g.unlocked[k] = true; });
    return g;
  }
  const emit = (g, e) => g.events.push(e);

  function buildCost(kind) { return CREW[kind].cost[0]; }
  function build(g, padIdx, kind) {
    const pad = g.pads[padIdx]; if (!pad || pad.tower || !g.unlocked[kind]) return false;
    const c = CREW[kind].cost[0]; if (g.coins < c) return false;
    g.coins -= c; g.stats.spent += c;
    const t = { id: g.nextId++, kind, lvl: 0, spec: null, prio: kind === 'silk' ? 'strong' : 'first', x: pad.x, y: pad.y, pad: padIdx, cd: 0.2, angle: -Math.PI / 2, fireT: -9, beams: [], beamHeat: [0, 0], invested: c, dmgDone: 0, kills: 0, pulses: 0, mood: 'idle', moodT: 0, upT: -9 };
    pad.tower = t; g.towers.push(t); emit(g, { type: 'build', t }); return t;
  }
  function upgrade(g, t, spec) {
    if (!t || t.lvl >= MAX_LVL) return false;
    if (t.lvl === MAX_LVL - 1 && spec !== 'a' && spec !== 'b') return false;
    const c = nextCost(t, spec); if (g.coins < c) return false;
    g.coins -= c; g.stats.spent += c; t.invested += c; t.lvl++; if (t.lvl === MAX_LVL) t.spec = spec; t.upT = g.t;
    emit(g, { type: 'upgrade', t }); return true;
  }
  function setPrio(t, p) { if (PRIOS.includes(p)) t.prio = p; }
  function sell(g, t) { if (!t) return 0; const v = Math.floor(t.invested * 0.7); g.coins += v; g.pads[t.pad].tower = null; g.towers = g.towers.filter(x => x !== t); emit(g, { type: 'sell', t, v }); return v; }

  function waveGroups(g, w) { return w <= FINAL_WAVE ? WAVES[w - 1] : endlessWave(w, g.rng); }
  function previewWave(g, w) { const gs = waveGroups(g, w); const m = {}; gs.forEach(([t, n, , , k]) => { const key = t + (k ? '#' + k : ''); m[key] = (m[key] || 0) + n; }); return m; }

  function startWave(g, early) {
    if (g.waveActive && g.spawnQ.length) return false;
    let bonus = 0;
    if (early && g.countdown != null && g.countdown > 0) { bonus = Math.ceil(g.countdown) * 2; g.coins += bonus; g.score += bonus * 5; g.stats.early += bonus; emit(g, { type: 'early', bonus }); }
    g.wave++; g.countdown = null; g.waveActive = true; g.leaksThisWave = 0;
    if (g.wave === 5) { g.unlocked.cyan = true; g.unlocked.sunny = true; emit(g, { type: 'unlock', kinds: ['cyan', 'sunny'] }); }
    if (g.wave === 8) { g.unlocked.nova = true; emit(g, { type: 'unlock', kinds: ['nova'] }); }
    const groups = waveGroups(g, g.wave);
    if (g.wave > FINAL_WAVE && g.wave % 5 === 0 && !groups.some(x => x[0] === 'boss')) groups.push(['boss', 1, 1, 6, 4]);
    for (const [type, n, gap, delay, k] of groups) for (let i = 0; i < n; i++) g.spawnQ.push({ at: g.t + delay + i * gap, type, k: k || 0 });
    g.spawnQ.sort((a, b) => a.at - b.at);
    emit(g, { type: 'wave', wave: g.wave });
    return true;
  }

  function spawn(g, type, k, d0) {
    const F = FOES[type], m = type === 'boss' ? (1 + 0.12 * (g.wave - 1)) * (g.wave >= 25 ? 2.2 : g.wave >= 20 ? 1.6 : 1) : hpMult(g.wave);
    const e = { id: g.nextId++, type, hp: F.hp * m, maxhp: F.hp * m, spd: F.spd * (1 + Math.min(0.25, g.wave * 0.006)), d: d0 || 0, x: 0, y: 0, armor: (F.armor || 0) * (1 + g.wave * 0.03), r: F.r,
      shield: k ? { k, got: new Set(), broken: false } : null, slowUntil: 0, slowF: 0, revealedUntil: 0, blinkT: F.blink ? F.blink * (0.6 + g.rng() * 0.6) : 0, hitFlash: 0, born: g.t, dotUntil: 0, dot: 0, bossNext: 0.88, knock: 0, markUntil: 0, markF: 0, stunUntil: 0 };
    const p = posAt(e.d); e.x = p.x; e.y = p.y;
    g.foes.push(e);
    if (!g.seenFoes[type + (k ? '#' : '')]) { g.seenFoes[type + (k ? '#' : '')] = true; emit(g, { type: 'newFoe', foe: type, coded: !!k }); }
    return e;
  }

  // phantoms shimmer into view for a moment every 2.2 s, and stay visible near Moss or after a hit
const visible = (g, e) => !FOES[e.type].invis || g.t < e.revealedUntil || ((g.t - e.born) % 2.2) < 0.55;
  function inAura(g, t) { let best = null; for (const c of g.towers) if (c.kind === 'cyan' && c !== t && Math.hypot(c.x - t.x, c.y - t.y) <= stat(c).range && (!best || stat(c).buff > stat(best).buff)) best = c; return best; }
  function rateMult(g, t) { let m = 1; const c = inAura(g, t); if (c) m += stat(c).buff; if (g.abilities.surge.active > 0) m += 0.7; return m; }

  // damage: shields block 85% until k independent shards land; armor reduces flat
  function hit(g, e, dmg, src, opt = {}) {
    if (e.hp <= 0) return;
    const recoded = opt.recoded || (src && src.kind !== 'cyan' && inAura(g, src));
    if (e.shield && !e.shield.broken) {
      const token = recoded || opt.ability || opt.fresh ? 'r' + (++g.tokenSeq) : 't' + (src ? src.id : 'x');
      const was = e.shield.got.size; e.shield.got.add(token);
      if (e.shield.got.size > was) emit(g, { type: 'shard', e, n: e.shield.got.size, k: e.shield.k, recoded: !!recoded });
      else if (!opt.quiet) emit(g, { type: 'redundant', e });
      if (e.shield.got.size >= e.shield.k) { e.shield.broken = true; g.stats.decoded++; g.score += 25; emit(g, { type: 'decoded', e }); }
      else dmg *= 0.15;
    }
    if (src && src.kind === 'nova' && e.shield && e.shield.broken) dmg *= 2;
    if (g.t < e.markUntil) dmg *= 1 + e.markF;
    if (!opt.pierce && e.armor) dmg = Math.max(dmg * 0.25, dmg - e.armor);
    e.hp -= dmg; e.hitFlash = 0.08; if (FOES[e.type].invis) e.revealedUntil = Math.max(e.revealedUntil, g.t + 0.6);
    if (src) src.dmgDone += dmg;
    if (src && src.kind === 'nova' && e.hp > 0 && e.hp / e.maxhp < stat(src).exec && !FOES[e.type].boss) { e.hp = 0; emit(g, { type: 'execute', e }); }
    if (FOES[e.type].boss) while (e.hp > 0 && e.hp / e.maxhp < e.bossNext) { e.bossNext -= 0.12; for (let i = 0; i < 5; i++) spawn(g, 'dupe', 0, Math.max(0, e.d - 10 - i * 14)); emit(g, { type: 'bossLeak', e }); }
    if (e.hp <= 0) kill(g, e, src);
  }
  function kill(g, e, src) {
    const F = FOES[e.type];
    // speed is money: kills made soon after the enemy appears pay a little extra
    const fast = Math.max(0, 1 - (g.t - e.born) / 14);
    const bounty = Math.round(F.bounty * (1 + 0.5 * fast));
    let extra = 0;
    for (const t of g.towers) if (t.kind === 'sunny' && t.spec === 'b' && Math.hypot(t.x - e.x, t.y - e.y) <= stat(t).range) extra += stat(t).bonus;
    g.coins += bounty + extra; g.score += bounty * 10; g.stats.kills++; if (F.boss) g.stats.bossKills++;
    if (src) { src.kills++; src.mood = 'happy'; src.moodT = 0.7; }
    emit(g, { type: 'kill', e, bounty: bounty + extra, fast: fast > 0.5 || extra > 0 });
  }
  function findTarget(g, t, range, prio, exclude) {
    let best = null, bv = -Infinity;
    for (const e of g.foes) {
      if (e.hp <= 0 || !visible(g, e) || (exclude && exclude.includes(e))) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y); if (d > range + e.r * 0.5) continue;
      const v = prio === 'last' ? -e.d : prio === 'strong' ? e.hp + e.d * 0.01 : prio === 'close' ? -d : e.d;
      if (v > bv) { bv = v; best = e; }
    }
    return best;
  }
  const distToSeg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)); return { d: Math.hypot(px - ax - u * dx, py - ay - u * dy), u }; };

  function useBurst(g, x, y) {
    const a = g.abilities.burst; if (a.left > 0 || g.over) return false; a.left = a.cd;
    g.fx.push({ kind: 'burst', x, y, t: 0, life: 0.7 });
    g.pendingBurst = { x, y, at: g.t + 0.45 };
    emit(g, { type: 'burst', x, y }); return true;
  }
  function useSurge(g) { const a = g.abilities.surge; if (a.left > 0 || g.over) return false; a.left = a.cd; a.active = 6; emit(g, { type: 'surge' }); return true; }

  function update(g, dt) {
    if (g.over) return;
    g.t += dt;
    for (const k in g.abilities) { const a = g.abilities[k]; a.left = Math.max(0, a.left - dt); if (a.active) a.active = Math.max(0, a.active - dt); }
    if (g.pendingBurst && g.t >= g.pendingBurst.at) {
      const { x, y } = g.pendingBurst; g.pendingBurst = null;
      for (const e of g.foes.slice()) if (Math.hypot(e.x - x, e.y - y) < 90 + e.r) { e.revealedUntil = g.t + 2; hit(g, e, 90 + g.wave * 6, null, { ability: true, pierce: true }); }
      g.fx.push({ kind: 'ring', x, y, t: 0, life: 0.5, r: 95, color: '#4DA3FF' });
    }
    // spawning
    while (g.spawnQ.length && g.spawnQ[0].at <= g.t) { const s = g.spawnQ.shift(); spawn(g, s.type, s.k); }
    // countdown between waves
    if (!g.waveActive && g.countdown != null) { g.countdown -= dt; if (g.countdown <= 0) startWave(g, false); }

    // enemies move
    for (const e of g.foes) {
      if (e.hp <= 0) continue;
      const F = FOES[e.type];
      let s = e.spd; if (g.t < e.slowUntil) s *= 1 - e.slowF; if (g.t < e.stunUntil) s = 0;
      if (e.knock > 0) { const k = Math.min(e.knock, 120 * dt); e.d -= k; e.knock -= k; }
      e.d += s * dt;
      if (F.blink) { e.blinkT -= dt; if (e.blinkT <= 0) { e.blinkT = F.blink * (0.7 + g.rng() * 0.6); if (g.t >= e.slowUntil) { g.fx.push({ kind: 'blink', x: e.x, y: e.y, t: 0, life: 0.35 }); e.d += 70; } } }
      if (g.t < e.dotUntil) hit(g, e, e.dot * dt, e.dotSrc || null, { pierce: true, quiet: true });
      if (e.hp <= 0) continue;
      const p = posAt(e.d); e.x = p.x; e.y = p.y; e.dir = p;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.d >= END_D) {
        e.hp = 0; e.leaked = true; g.lives -= F.lives; g.leaksThisWave += F.lives; g.stats.leaks += F.lives;
        emit(g, { type: 'leak', e, lives: F.lives });
        if (g.lives <= 0) { g.lives = 0; g.over = true; g.won = false; emit(g, { type: 'gameover' }); }
      }
    }

    // fire zones
    for (const z of g.zones) for (const e of g.foes) if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.r * 0.5) hit(g, e, z.dps * dt, z.src, { pierce: true, quiet: true, zone: true });
    g.zones = g.zones.filter(z => g.t < z.until);

    // towers act
    for (const t of g.towers) {
      const S = stat(t); t.moodT = Math.max(0, t.moodT - dt); if (t.moodT <= 0 && t.mood !== 'idle') t.mood = 'idle';
      const rm = rateMult(g, t);
      if (t.kind === 'sunny') {
        if (t.spec !== 'b') continue;
        t.cd -= dt * rm;
        const tg = findTarget(g, t, S.range, t.prio);
        if (tg) t.angle = Math.atan2(tg.y - t.y, tg.x - t.x);
        if (t.cd <= 0 && tg) { t.cd = 1 / S.rate; t.fireT = g.t; g.shots.push({ kind: 'coin', x: t.x, y: t.y - 30, tg, spd: 560, dmg: S.dmg, src: t, lvl: t.lvl, spec: t.spec }); }
        continue;
      }
      if (t.kind === 'moss') {
        t.cd -= dt * rm;
        if (t.cd <= 0) {
          t.cd = 1.0; let any = false; t.pulses++;
          const stun = S.stun && t.pulses % 4 === 0;
          for (const e of g.foes) if (e.hp > 0 && Math.hypot(e.x - t.x, e.y - t.y) <= S.range + e.r) {
            any = true; e.slowUntil = g.t + 1.6; e.slowF = Math.max(g.t < e.slowUntil ? e.slowF : 0, S.slow); e.revealedUntil = g.t + 1.3;
            if (S.dot) { e.dot = S.dot; e.dotUntil = g.t + 1.1; e.dotSrc = t; }
            if (S.mark) { e.markUntil = g.t + 2.2; e.markF = S.mark; }
            if (stun && !FOES[e.type].boss) e.stunUntil = g.t + S.stun;
          }
          if (any) { t.fireT = g.t; g.fx.push({ kind: 'pulse', x: t.x, y: t.y, t: 0, life: stun ? 0.9 : 0.6, r: S.range, color: stun ? '#c8ffb8' : S.mark ? '#ffd23f' : '#7bdc6a', lvl: t.lvl, stun }); if (stun) emit(g, { type: 'stun', t }); }
        }
        for (const e of g.foes) if (FOES[e.type].invis && Math.hypot(e.x - t.x, e.y - t.y) <= S.range) e.revealedUntil = Math.max(e.revealedUntil, g.t + 0.3);
        continue;
      }
      if (t.kind === 'nova') {
        const n = S.beams || 1, heatRate = S.heat || 1;
        const keep = [];
        for (let i = 0; i < n; i++) {
          let tg = t.beams[i];
          if (!(tg && tg.hp > 0 && visible(g, tg) && Math.hypot(tg.x - t.x, tg.y - t.y) <= S.range + tg.r) || keep.includes(tg)) { tg = findTarget(g, t, S.range, t.prio, keep); t.beamHeat[i] = 0; }
          keep.push(tg); t.beams[i] = tg;
          if (!tg) continue;
          t.beamHeat[i] = Math.min(2.5, (t.beamHeat[i] || 0) + dt * heatRate);
          t.angle = Math.atan2(tg.y - t.y, tg.x - t.x); t.fireT = g.t; t.mood = 'focus'; t.moodT = 0.2;
          const dmg = S.dps * (1 + 0.6 * t.beamHeat[i]) * rm * dt;
          const victims = [tg];
          if (S.line) {
            const ex = t.x + Math.cos(t.angle) * S.range, ey = t.y - 40 + Math.sin(t.angle) * S.range;
            t.lineEnd = { x: ex, y: ey };
            for (const e of g.foes) if (e !== tg && e.hp > 0 && visible(g, e) && distToSeg(e.x, e.y, t.x, t.y - 40, ex, ey).d <= 14 + e.r) victims.push(e);
          }
          for (const e of victims) {
            if (e.shield && !e.shield.broken) { e.novaAcc = (e.novaAcc || 0) + dmg; e.novaTick = (e.novaTick || 0) + dt; if (e.novaTick >= 0.4) { e.novaTick = 0; const a = e.novaAcc; e.novaAcc = 0; hit(g, e, a, t, { pierce: true }); } }
            else hit(g, e, dmg, t, { pierce: true, quiet: true });
          }
        }
        t.beams.length = n; keep.length = 0;
        continue;
      }
      t.cd -= dt * rm;
      const range = S.range;
      const tg = findTarget(g, t, range, t.prio);
      if (tg) t.angle = Math.atan2(tg.y - t.y, tg.x - t.x);
      if (t.cd <= 0 && tg) {
        t.cd = 1 / S.rate; t.fireT = g.t; t.mood = 'focus'; t.moodT = 0.25;
        const base = { src: t, lvl: t.lvl, spec: t.spec };
        if (t.kind === 'spike') {
          if (S.rail) {
            const ang = Math.atan2(tg.y - (t.y - 22), tg.x - t.x), ex = t.x + Math.cos(ang) * (range + 60), ey = t.y - 22 + Math.sin(ang) * (range + 60);
            const hits = g.foes.filter(e => e.hp > 0 && visible(g, e)).map(e => ({ e, ...distToSeg(e.x, e.y, t.x, t.y - 22, ex, ey) })).filter(o => o.d <= 12 + o.e.r).sort((a, b) => a.u - b.u).slice(0, S.rail);
            for (const o of hits) hit(g, o.e, S.dmg, t, { pierce: true });
            g.fx.push({ kind: 'rail', x: t.x, y: t.y - 22, x2: ex, y2: ey, t: 0, life: 0.32 });
          } else {
            const targets = [tg];
            while (targets.length < S.shots) { const e = findTarget(g, t, range, t.prio, targets); if (!e) break; targets.push(e); }
            for (const e of targets) g.shots.push({ kind: 'shard', x: t.x, y: t.y - 22, tg: e, spd: 520 + t.lvl * 60, dmg: S.dmg, fresh: !!S.fresh, ...base });
          }
        } else if (t.kind === 'silk') {
          const crit = S.crit && g.rng() < S.crit;
          g.shots.push({ kind: 'lance', x: t.x, y: t.y - 22, tg, spd: 900 + t.lvl * 150, dmg: S.dmg * (crit ? (S.critX || 2.5) : 1), pierce: !!S.pierce, crit, shrapnel: S.shrapnel, ...base });
        } else if (t.kind === 'blaze') {
          g.shots.push({ kind: 'bomb', x: t.x, y: t.y - 22, tx: tg.x, ty: tg.y, tg, spd: 380, dmg: S.dmg, splash: S.splash, knock: S.knock || 0, cluster: S.cluster || 0, fire: S.fire, t0: g.t, ...base });
        } else if (t.kind === 'cyan') {
          const chain = [tg]; let last = tg;
          while (chain.length < (S.chain || 1)) { let nx = null, bd = 115; for (const e of g.foes) { if (e.hp <= 0 || chain.includes(e) || !visible(g, e)) continue; const d = Math.hypot(e.x - last.x, e.y - last.y); if (d < bd) { bd = d; nx = e; } } if (!nx) break; chain.push(nx); last = nx; }
          let px = t.x, py = t.y - 22;
          chain.forEach((e, i) => { g.fx.push({ kind: 'zap', x: px, y: py, x2: e.x, y2: e.y, t: 0, life: 0.18, lvl: t.lvl, spec: t.spec }); hit(g, e, S.dmg * (i ? 0.8 : 1), t, { recoded: true }); px = e.x; py = e.y; });
        }
      }
    }

    // projectiles
    for (const s of g.shots) {
      if (s.done) continue;
      const tx = s.tg && s.tg.hp > 0 ? s.tg.x : s.tx ?? s.lx, ty = s.tg && s.tg.hp > 0 ? s.tg.y : s.ty ?? s.ly;
      if (s.tg && s.tg.hp > 0) { s.lx = s.tg.x; s.ly = s.tg.y; }
      const dx = (tx ?? s.x) - s.x, dy = (ty ?? s.y) - s.y, d = Math.hypot(dx, dy), step = s.spd * dt;
      if (d <= step || tx == null) {
        s.done = true;
        if (s.kind === 'bomb' || s.kind === 'bomblet') {
          const bx = tx ?? s.x, by = ty ?? s.y;
          for (const e of g.foes) if (e.hp > 0 && Math.hypot(e.x - bx, e.y - by) <= s.splash + e.r) { hit(g, e, s.dmg, s.src); if (s.knock) e.knock = s.knock; }
          g.fx.push({ kind: 'ring', x: bx, y: by, t: 0, life: 0.4, r: s.splash, color: s.fire ? '#ff9a3c' : '#ff5a4e', lvl: s.lvl });
          if (s.cluster) for (let i = 0; i < s.cluster; i++) { const a = i / s.cluster * Math.PI * 2 + g.rng(); g.shots.push({ kind: 'bomblet', x: bx, y: by, tx: bx + Math.cos(a) * 58, ty: by + Math.sin(a) * 40, spd: 260, dmg: s.dmg * 0.5, splash: 40, src: s.src, t0: g.t, lvl: s.lvl, spec: s.spec }); }
          if (s.fire) { g.zones.push({ x: bx, y: by, r: s.fire.r, dps: s.fire.dps, until: g.t + s.fire.dur, src: s.src, t0: g.t }); }
          if (s.kind === 'bomb') emit(g, { type: 'boom', lvl: s.lvl });
        } else if (s.tg && s.tg.hp > 0) {
          const tgt = s.tg;
          hit(g, tgt, s.dmg, s.src, { pierce: s.pierce, fresh: s.fresh });
          g.fx.push({ kind: 'spark', x: tgt.x, y: tgt.y, t: 0, life: 0.25 + (s.lvl || 0) * 0.04, crit: s.crit, lvl: s.lvl, color: s.kind === 'coin' ? '#ffd23f' : null });
          if (s.shrapnel) {
            const near = g.foes.filter(e => e !== tgt && e.hp > 0 && Math.hypot(e.x - tgt.x, e.y - tgt.y) <= s.shrapnel.r).sort((a, b) => Math.hypot(a.x - tgt.x, a.y - tgt.y) - Math.hypot(b.x - tgt.x, b.y - tgt.y)).slice(0, s.shrapnel.n);
            for (let i = 0; i < s.shrapnel.n; i++) { const e = near[i]; const a = i / s.shrapnel.n * Math.PI * 2; g.fx.push({ kind: 'frag', x: tgt.x, y: tgt.y, x2: e ? e.x : tgt.x + Math.cos(a) * s.shrapnel.r, y2: e ? e.y : tgt.y + Math.sin(a) * s.shrapnel.r, t: 0, life: 0.22 }); if (e) hit(g, e, s.shrapnel.dmg, s.src, { pierce: true }); }
          }
          if (s.crit) emit(g, { type: 'crit', e: tgt, dmg: s.dmg });
        }
      } else { s.x += dx / d * step; s.y += dy / d * step; s.ang = Math.atan2(dy, dx); }
    }
    g.shots = g.shots.filter(s => !s.done);
    g.foes = g.foes.filter(e => e.hp > 0);
    for (const f of g.fx) f.t += dt; g.fx = g.fx.filter(f => f.t < f.life);

    // wave end
    if (g.waveActive && !g.spawnQ.length && !g.foes.length) {
      g.waveActive = false;
      let income = 0; for (const t of g.towers) if (t.kind === 'sunny') { const S = stat(t); income += S.income + Math.min(t.spec === 'a' ? 120 : 60, Math.floor(g.coins * S.interest)); }
      const clear = 30 + g.wave * 5;
      g.coins += clear + income;
      g.score += 100 * g.wave + (g.leaksThisWave ? 0 : 50 * g.wave);
      emit(g, { type: 'waveClear', wave: g.wave, income, clear, perfect: !g.leaksThisWave });
      for (const t of g.towers) { t.mood = 'excited'; t.moodT = 1.4; }
      if (g.wave === FINAL_WAVE && !g.endless) { g.won = true; g.score += g.lives * 200; emit(g, { type: 'victory' }); g.countdown = null; g.state = 'victory'; }
      else g.countdown = 18;
    }
  }

  root.TD = { W, H, PATH, PADS, PATH_LEN, END_D, posAt, CREW, CREW_ORDER, FOES, WAVES, FINAL_WAVE, newGame, update, build, upgrade, sell, setPrio, startWave, previewWave, useBurst, useSurge, buildCost, nextCost, stat, statAt, MAX_LVL, PRIOS, inAura, rateMult, visible };
})(typeof window !== 'undefined' ? window : globalThis);
