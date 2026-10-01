// Campaign stages: parkour (paths), build pads, look and difficulty. Loaded before core.js.
// Every path ends at the validator vault. A stage with two paths sends enemies down both.
(function (root) {
  'use strict';
  const STAGES = [
    {
      id: 1, key: 'hoodi', name: 'Hoodi Testnet', sub: 'Where every validator starts',
      blurb: 'The private testnet. One long pipe, friendly traffic, room to learn the crew.',
      waves: 15, hp: 1.0, speed: 1.0, coins: 220, lives: 20, scoreMult: 1.0, codedBonus: 0,
      theme: 'hoodi', tier: 'Beginner',
      rule: null,
      optimum: "Optimum picked Ethereum's Hoodi testnet to roll out OptimumP2P with validator teams. Every crew starts here.",
      paths: [[[-40, 170], [260, 170], [260, 500], [520, 500], [520, 250], [800, 250], [800, 560], [1060, 560], [1060, 330], [1215, 330]]],
      pads: [[700, 455], [170, 262], [352, 300], [170, 430], [390, 592], [390, 410], [430, 250], [640, 160], [610, 380], [930, 640], [890, 430], [970, 330], [1150, 450], [1170, 245], [710, 560], [1230, 420]],
    },
    {
      id: 2, key: 'blob', name: 'Blob Season', sub: 'Big blocks, bigger floods',
      blurb: 'Blob traffic floods a tight zigzag. More Dupes, thicker armor, coded shields need one extra shard.',
      waves: 18, hp: 1.42, speed: 1.04, coins: 240, lives: 20, scoreMult: 1.3, codedBonus: 1,
      theme: 'blob', tier: 'Intermediate', split: 3,
      optimum: 'mump2p carries blocks, blobs and transactions. In Optimum\'s early A/B tests Gossipsub choked on 4 MB messages under load while mump2p carried 10 MB.',
      rule: { name: 'Blob burst', text: 'Blobs are big. Gossiped the old way, a Bandwidth Hog bursts into 3 duplicate copies when it goes down, and coded shields need one extra shard. Keep splash right behind your Silk.' },
      paths: [[[-40, 130], [860, 130], [860, 330], [300, 330], [300, 510], [1180, 510]]],
      pads: null,
    },
    {
      id: 3, key: 'subsea', name: 'Subsea Cable', sub: 'Two routes, one vault',
      blurb: 'Traffic arrives from two continents and merges under the sea. Split your crew or lose a flank.',
      waves: 21, hp: 1.0, speed: 1.06, coins: 270, lives: 20, scoreMult: 1.6, codedBonus: 1,
      theme: 'subsea', tier: 'Advanced',
      lossy: [[[420, 360], [700, 360]], [[700, 190], [1000, 190]]], loss: 0.3,
      optimum: 'RLNC is built for lossy links: any k coded shards rebuild the message, so a dropped shard costs nothing. Flexnodes keep coded buffers for loss recovery.',
      rule: { name: 'Lossy cable', text: 'The undersea stretch drops 30% of plain shots. Coded shots never get lost: anything recoded by Cyan, Fountain Coder shards and your abilities. RLNC is built for lossy links.' },
      paths: [
        [[-40, 140], [420, 140], [420, 360], [700, 360], [700, 190], [1000, 190], [1000, 430], [1190, 430]],
        [[-40, 560], [420, 560], [420, 360], [700, 360], [700, 190], [1000, 190], [1000, 430], [1190, 430]],
      ],
      pads: null,
    },
    {
      id: 4, key: 'mainnet', name: 'Mainnet', sub: 'Speed is money',
      blurb: 'The real thing. Two entries feed one long trunk, and the last wave brings twin Gossip Blobs. Survive all 25 waves, then go endless.',
      waves: 25, hp: 0.72, speed: 1.08, coins: 300, lives: 20, scoreMult: 2.0, codedBonus: 1, endless: true,
      theme: 'mainnet', tier: 'Expert', leakCoins: 15, earlyX: 2,
      optimum: 'Optimum\'s slogan is the rule: validators, builders and traders pay for every millisecond a block arrives late.',
      rule: { name: 'Speed is money', text: 'Every leaked life also costs 15 coins, and calling a wave early pays double. Fast and clean wins.' },
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
  const HUD = [[0, 0, 700, 64], [1130, 0, 1280, 64], [960, 548, 1280, 720], [0, 626, 200, 720]];
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

  root.TD_STAGES = STAGES; root.TD_autoPads = autoPads;
})(typeof window !== 'undefined' ? window : globalThis);
