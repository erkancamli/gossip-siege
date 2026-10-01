# Gossip Siege

A fan made tower defense game for the [Optimum](https://www.getoptimum.xyz) community. Hire the Optimum crew, crack coded armor with independent shards and hold the validator mesh for 25 waves. Speed is money.

Not an official Optimum product.

## How the RLNC idea shows up in play

Coded enemies wear a shield with k segments. It only breaks after hits from k different crew members, the same way a block coded with Random Linear Network Coding only decodes once k independent shards arrive. Repeat hits from one tower are redundant copies. Cyan, the Recoder, remixes the shots of nearby crew so every hit counts as new, like an RLNC relay recoding shards without decoding them.

## Crew upgrades

Every crew member has four levels, the Kingdom Rush pattern. Levels 1 to 3 raise damage, fire rate and range, and the weapon visibly grows: bigger, brighter projectiles with longer trails, more shards per volley, shoulder pads, then a halo. At level 4 each crew member picks one of two specializations with a completely different weapon and gets a cape and crown in its colour.

| Crew | Level 4 A | Level 4 B |
| --- | --- | --- |
| Spike, Encoder | Fountain Coder: every shard counts as independent | Railshard: pierces 6 enemies, ignores armor |
| Blaze, Flood Breaker | Cluster Flood: blasts split into 4 bomblets | Firewall: leaves a burning zone on the path |
| Moss, Throttle | Rate Limiter: every 4th pulse freezes | Peer Scoring: marked enemies take +35% damage |
| Silk, Long Haul | Global Relay: map wide, 40% triple crits | Shrapnel Lance: bursts into 6 fragments |
| Cyan, Recoder | Mesh Amplifier: bigger aura, +85% crew speed | Chain Recoder: zap chains across 5 enemies |
| Sunny, Flexnode Bank | Validator Fund: 130 per wave, 8% interest | MEV Hunter: throws gold, +3 coins per kill nearby |
| Nova, Decoder | Decode Ray: the beam burns through a line | Twin Decoder: two beams, decodes below 30% |

Upgrade buttons show every stat as "now → next" before you buy, and each damage dealing crew member has a target priority (First, Last, Strong, Close).

## Project layout

```
src/core.js                   game rules, waves and combat (no DOM, deterministic)
src/game.html                 rendering, UI, audio, leaderboard client
src/bot.cjs                   balance bot: node src/bot.cjs
public/                       static files (favicon, link preview image)
netlify/functions/leaderboard.mjs   leaderboard API on Netlify Functions + Netlify Blobs
scripts/build.mjs             builds dist/index.html from src/ and checks every script parses
test/                         API tests and a local dev server
```

## Leaderboard API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/run` | POST | Signed run ticket, requested when a run starts |
| `/api/scores` | GET | Top 50, best score per X handle |
| `/api/scores` | POST | Submit a finished run |

Players have no accounts, so a determined cheater can still forge a score. The API stops the easy ways: a server signed ticket per run, a minimum real play time per wave, a score ceiling derived from the game's own scoring, one ticket per handle, and a short rate limit per client.

## Deploy on Netlify

1. Import this repository in Netlify (Add new site, Import an existing project, GitHub).
2. Build settings are read from `netlify.toml`; nothing to change.
3. Deploy. Netlify Blobs needs no setup, and the leaderboard generates its own signing secret on first use. Setting `RUN_SECRET` (16+ random characters) in the environment variables is optional and overrides it.

## Local checks

```
npm install
npm test                     # API tests
npm run build
node test/devserver.mjs      # serves dist/ and the API on http://localhost:8787
```
