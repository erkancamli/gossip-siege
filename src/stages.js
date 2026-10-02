// Campaign stages: parkour (paths), build pads, look and difficulty. Loaded before core.js.
// Every path ends at the validator vault. A stage with two paths sends enemies down both.
(function (root) {
  'use strict';
  // Stress Test runs on the Optimum mark: enter at the left tip of an infinity loop, ride it once round
  // (crossing the center twice) and leave upward to the vault.
  function infinityRoute() {
    const cx = 700, cy = 380, A = 450, pts = [[-40, cy]];
    for (let i = 0; i <= 48; i++) { const t = Math.PI - (i / 48) * 2 * Math.PI, d = 1 + Math.sin(t) ** 2; pts.push([Math.round(cx + A * Math.cos(t) / d), Math.round(cy + A * Math.sin(t) * Math.cos(t) / d)]); }
    pts.push([cx - A, 150]);
    return pts;
  }
  // Ten stages, each tied to one documented Optimum idea. Sources: getoptimum.xyz, docs.getoptimum.xyz,
  // github.com/getoptimum/optimum-gateway and the OptimumP2P testnet announcement.
  const STAGES = [
    {
      id: 1, key: 'hoodi', name: 'Hoodi Testnet', guide: { name: 'Nicolas Nicolaou', note: "co-author of Optimum's 'Acceleration: mump2p Early Results on Hoodi Testnet' and of the OptimumP2P paper" }, sub: 'Where every validator starts', tier: 'Beginner', theme: 'hoodi',
      hint: 'Two crew members on one bend beat four spread out. Coded shields open only to hits from different crew members.',
      blurb: 'One long pipe, friendly traffic, room to learn the crew.',
      waves: 12, hp: 1.6, speed: 1.0, coins: 220, lives: 20, scoreMult: 1.0, codedBonus: 0,
      rule: null,
      optimum: "Optimum picked Ethereum's Hoodi testnet to roll out its network with validator teams, and says blocks there arrive in about 150 ms on average.",
      paths: [[[-40, 170], [260, 170], [260, 500], [520, 500], [520, 250], [800, 250], [800, 560], [1060, 560], [1060, 330], [1215, 330]]],
      pads: [[700, 455], [170, 262], [352, 300], [170, 430], [390, 592], [390, 410], [430, 250], [640, 160], [610, 380], [790, 640], [890, 430], [970, 330], [1150, 450], [1170, 245], [710, 560], [1230, 420]],
    },
    {
      id: 2, key: 'flood', name: 'Copy Storm', guide: { name: 'Aayush Rajasekaran', note: "co-author of 'Comparing the Performance of OptimumP2P and Gossipsub' and of the OptimumP2P paper" }, sub: 'Why Gossipsub wastes bandwidth', tier: 'Beginner', theme: 'flood',
      hint: 'Dupes come in swarms: one blast from Jeff clears a whole pack.',
      blurb: 'A vortex of duplicate copies spirals into the vault.',
      waves: 14, hp: 2.6, speed: 1.02, coins: 230, lives: 20, scoreMult: 1.1, codedBonus: 0, dupeX: 2.5,
      rule: { name: 'Copy storm', text: 'Dupe swarms are two and a half times larger. Every Dupe is a redundant full copy, so splash crews like Jeff pay off.' },
      optimum: 'Gossipsub forwards whole messages, so peers receive the same block again and again. mump2p sends coded shards instead, and Optimum claims about 90 to 95% less bandwidth than gossipsub.',
      paths: [[[-40, 360], [160, 360], [160, 110], [1100, 110], [1100, 500], [360, 500], [360, 260], [860, 260], [860, 380], [620, 380]]],
      pads: null,
    },
    {
      id: 3, key: 'shard', name: 'Shard Threshold', guide: { name: 'Onyeka Obi', note: "co-author of the OptimumP2P paper" }, sub: 'You never need every shard', tier: 'Intermediate', theme: 'shard',
      hint: 'From wave 5 every enemy is coded. Put three different crew members on the same stretch.',
      blurb: 'A valley route where every message from wave 5 on is coded.',
      waves: 15, hp: 1.55, speed: 1.02, coins: 240, lives: 20, scoreMult: 1.2, codedBonus: 0, allCoded: 4, codedFrom: 5, threshold: 0.75,
      rule: { name: 'Shard threshold', text: 'From wave 5 every enemy is coded into 4 shards, but a shield opens at 75%: 3 different crew members are enough.' },
      optimum: 'In mump2p a message is split into shards (default shard factor 4) and a node can forward or decode once it holds the threshold share, 75% by default.',
      paths: [[[-40, 120], [260, 120], [260, 300], [520, 300], [520, 480], [780, 480], [780, 260], [1040, 260], [1040, 140], [1200, 140]]],
      pads: null,
    },
    {
      id: 4, key: 'blob', name: 'Blob Season', guide: { name: 'Aleksandr Bezobchuk', note: "co-author of the OptimumP2P paper and a contributor to Optimum's docs" }, sub: 'Big blocks, bigger floods', tier: 'Intermediate', theme: 'blob',
      hint: "Bandwidth Hogs split into three when they die: kill them where Jeff's splash catches the pieces.",
      blurb: 'Blob traffic floods a tight zigzag.',
      waves: 16, hp: 2.7, speed: 1.04, coins: 240, lives: 20, scoreMult: 1.3, codedBonus: 1, split: 3,
      rule: { name: 'Blob burst', text: 'Blobs are big. Gossiped the old way, a Bandwidth Hog bursts into 3 duplicate copies when it goes down, and coded shields need one extra shard.' },
      optimum: "mump2p carries blocks, blobs and transactions. In Optimum's early A/B tests Gossipsub choked on 4 MB messages under load while mump2p carried 10 MB.",
      paths: [[[-40, 130], [860, 130], [860, 330], [300, 330], [300, 510], [1180, 510]]],
      pads: null,
    },
    {
      id: 5, key: 'mesh', name: 'Mesh Limits', guide: { name: 'Har Preet Singh', note: "co-author of the OptimumP2P versus Gossipsub comparison and of the OptimumP2P paper, and a contributor to the mump2p dev setup guide" }, sub: 'Six peers is the sweet spot', tier: 'Intermediate', theme: 'mesh',
      hint: 'Six crew members is the sweet spot: the whole crew fires 15% faster. Upgrade instead of spamming.',
      blurb: 'A column route through a peer graph. Your crew is the mesh.',
      waves: 17, hp: 2.4, speed: 1.04, coins: 250, lives: 20, scoreMult: 1.4, codedBonus: 0, crewCap: 12, meshTarget: 6, meshBonus: 0.15,
      rule: { name: 'Mesh degree', text: 'At most 12 crew members (the mesh maximum). Once 6 are hired (the mesh target) the whole crew fires 15% faster. Upgrade, do not spam.' },
      optimum: 'mump2p keeps a peer mesh like Gossipsub: target 6 peers, add more below 4, prune above 12.',
      paths: [[[-40, 550], [240, 550], [240, 120], [520, 120], [520, 560], [800, 560], [800, 120], [1080, 120], [1080, 400], [1200, 400]]],
      pads: null,
    },
    {
      id: 6, key: 'subsea', name: 'Subsea Cable', guide: { name: 'Santiago Paiva', note: "co-author of the OptimumP2P paper and a contributor to Optimum's docs" }, sub: 'Two routes, one vault', tier: 'Advanced', theme: 'subsea',
      hint: 'The undersea stretch drops 30% of plain shots. Shots near Muriel are coded, and coded shots never drop.',
      blurb: 'Traffic arrives from two continents and merges under the sea.',
      waves: 18, hp: 1.35, speed: 1.06, coins: 270, lives: 20, scoreMult: 1.5, codedBonus: 1,
      lossy: [[[420, 360], [700, 360]], [[700, 190], [1000, 190]]], loss: 0.3,
      rule: { name: 'Lossy cable', text: 'The undersea stretch drops 30% of plain shots. Coded shots never get lost: anything recoded by Muriel, Fountain Coder shards and your abilities.' },
      optimum: 'RLNC is built for lossy links: any k independent coded shards rebuild the message, so a dropped shard costs nothing. Flexnodes keep coded buffers for loss recovery.',
      paths: [
        [[-40, 140], [420, 140], [420, 360], [700, 360], [700, 190], [1000, 190], [1000, 430], [1190, 430]],
        [[-40, 560], [420, 560], [420, 360], [700, 360], [700, 190], [1000, 190], [1000, 430], [1190, 430]],
      ],
      pads: null,
    },
    {
      id: 7, key: 'flex', name: 'Flexnode Grid', guide: { name: 'Michael Meier', note: "co-author of the OptimumP2P paper" }, sub: 'A global network of data accelerators', tier: 'Advanced', theme: 'flex',
      hint: 'Build on the five glowing Flexnode pads: 25% faster fire and every shot counts as a fresh shard.',
      blurb: 'Some pads are Flexnodes. Build on them.',
      waves: 19, hp: 1.9, speed: 1.06, coins: 270, lives: 20, scoreMult: 1.6, codedBonus: 1, flexPick: 5,
      rule: { name: 'Flexnode pads', text: 'Five glowing pads are Flexnodes. Crew built there fire 25% faster and every shot is a coded shard, so it always counts as new on a shield.' },
      optimum: 'Flexnodes are permissionless nodes that encode, decode and forward RLNC coded frames. Operators earn rewards for contributing bandwidth.',
      paths: [[[-40, 250], [200, 250], [200, 560], [560, 560], [560, 130], [900, 130], [900, 460], [1180, 460]]],
      pads: null,
    },
    {
      id: 8, key: 'gateway', name: 'The Gateway', guide: { name: 'Alejandro Bergasov', note: "co-author of the OptimumP2P paper and a contributor to Optimum Gateway" }, sub: 'Plug in, no client changes', tier: 'Expert', theme: 'gateway',
      hint: 'Past the Gateway every hit is a coded shard. Put your strongest crew on the second half.',
      blurb: 'The left half is plain libp2p. The right half is mump2p.',
      waves: 20, hp: 1.65, speed: 1.08, coins: 280, lives: 20, scoreMult: 1.7, codedBonus: 0, allCoded: 3, codedFrom: 6, gateway: 0.45,
      rule: { name: 'Gateway', text: 'From wave 6 every enemy is coded. Past the Gateway, a bit before halfway, every hit from any crew member lands as a coded shard. Hold the second half.' },
      optimum: 'Optimum Gateway lets Prysm, Lighthouse, Nimbus, Teku and Lodestar use mump2p with no client changes: it takes their gossip, carries it over RLNC and hands it back.',
      paths: [[[-40, 380], [280, 380], [280, 130], [640, 130], [640, 590], [900, 590], [900, 300], [1190, 300]]],
      pads: null,
    },
    {
      id: 9, key: 'stress', name: 'Stress Test', guide: { name: 'Prof. Sriram Vishwanath', note: "Optimum advisor and co-author of the OptimumP2P paper, working on information theory and network science" }, sub: 'High traffic, no excuses', tier: 'Expert', theme: 'stress',
      hint: 'Twice the enemies with half the health: splash and chain hits win here.',
      blurb: 'The route is the Optimum mark itself: one full infinity loop, crossing the center twice.',
      waves: 22, hp: 1.25, speed: 1.08, coins: 290, lives: 20, scoreMult: 1.85, codedBonus: 1, countX: 2, bountyX: 0.5,
      rule: { name: 'Stress test', text: 'From wave 3 every wave sends twice as many enemies, each with less health. Splash and chains beat single shots.' },
      optimum: 'In early A/B tests Optimum reported about 10x lower latency than Gossipsub under high traffic and no lost messages in stress scenarios.',
      paths: [infinityRoute()],
      pads: null,
    },
    {
      id: 10, key: 'mainnet', name: 'Mainnet', guide: { name: 'Moritz Grundei', note: "co-author of Optimum's study on how lower latency raises ETH staking revenue" }, sub: 'Speed is money', tier: 'Master', theme: 'mainnet',
      hint: 'Every leaked validator costs 15 coins and calling waves early pays double. Fast and clean.',
      blurb: 'Two entries feed one long trunk, and the last wave brings twin Gossip Blobs. Then go endless.',
      waves: 25, hp: 1.45, speed: 1.08, coins: 300, lives: 20, scoreMult: 2.0, codedBonus: 1, endless: true, leakCoins: 15, earlyX: 2,
      rule: { name: 'Speed is money', text: 'Every leaked life also costs 15 coins, and calling a wave early pays double. Fast and clean wins.' },
      optimum: 'Optimum says faster propagation means more attestation rewards, better MEV opportunities and fewer missed proposals for validators.',
      paths: [
        [[-40, 110], [300, 110], [300, 330], [520, 330], [520, 120], [760, 120], [760, 480], [960, 480], [960, 200], [1150, 200], [1150, 420], [1210, 420]],
        [[-40, 560], [300, 560], [300, 330], [520, 330], [520, 120], [760, 120], [760, 480], [960, 480], [960, 200], [1150, 200], [1150, 420], [1210, 420]],
      ],
      pads: null,
    },
  ];

  // Pads for stages without hand placed ones: candidates beside the path, ranked by how much
  // path they cover, kept clear of the path, the HUD and each other. Deterministic.
  // HUD boxes in frame pixels: top chips, top right controls, wave panel, ability buttons
  // screen furniture pads must stay clear of, in world px, sized for phones in landscape where the wave box and abilities scale up 1.25x
  const HUD = [[0, 0, 700, 64], [1130, 0, 1280, 64], [854, 532, 1280, 720], [0, 625, 211, 720]];
  const segs = (paths) => paths.flatMap((p) => p.slice(1).map((b, i) => [p[i], b]));
  function distSeg(x, y, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy); }
  function autoPads(stage, n = 17) {
    const S = segs(stage.paths), cand = [];
    for (const [a, b] of S) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      for (let t = 30; t < L - 10; t += 24) for (const side of [-1, 1]) {
        const x = Math.round(a[0] + (b[0] - a[0]) * t / L + nx * 92 * side), y = Math.round(a[1] + (b[1] - a[1]) * t / L + ny * 92 * side);
        if (x < 50 || x > 1235 || y < 86 || y > 676) continue;
        if (HUD.some(([x0, y0, x1, y1]) => x > x0 - 30 && x < x1 + 30 && y > y0 - 26 && y < y1 + 26)) continue;
        if (Math.min(...S.map(([p, q]) => distSeg(x, y, p, q))) < 80) continue;
        let cover = 0;
        for (const [p, q] of S) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let u = 0; u < l; u += 8) if (Math.hypot(p[0] + (q[0] - p[0]) * u / l - x, p[1] + (q[1] - p[1]) * u / l - y) < 140) cover += 8; }
        cand.push([x, y, cover]);
      }
    }
    cand.sort((a, b) => b[2] - a[2]);
    const out = [];
    for (const c of cand) { if (out.length >= n) break; if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) >= 104)) out.push(c); }
    return out.map(([x, y]) => [x, y]);
  }
  for (const s of STAGES) if (!s.pads) s.pads = autoPads(s);
  // Flexnode stage: the pads that cover the most route become Flexnodes (spread out, not adjacent)
  for (const s of STAGES) if (s.flexPick) { const ranked = s.pads.map((p, i) => [i, p]).filter(([, p]) => true); const pick = []; for (const [i, p] of ranked) { if (pick.length >= s.flexPick) break; if (pick.every((j) => Math.hypot(s.pads[j][0] - p[0], s.pads[j][1] - p[1]) > 220)) pick.push(i); } s.flexPads = pick; }

  root.TD_STAGES = STAGES; root.TD_autoPads = autoPads;
})(typeof window !== 'undefined' ? window : globalThis);
