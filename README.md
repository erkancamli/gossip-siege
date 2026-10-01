# Gossip Siege

A fan made tower defense game for the [Optimum](https://www.getoptimum.xyz) community. Hire the Optimum crew, crack coded armor with independent shards and hold the validator mesh for 25 waves. Speed is money.

Not an official Optimum product.

## How the RLNC idea shows up in play

Coded enemies wear a shield with k segments. It only breaks after hits from k different crew members, the same way a block coded with Random Linear Network Coding only decodes once k independent shards arrive. Repeat hits from one tower are redundant copies. Cyan, the Recoder, remixes the shots of nearby crew so every hit counts as new, like an RLNC relay recoding shards without decoding them.

## Project layout

```
public/                       static site (index.html is the whole game)
netlify/functions/leaderboard.mjs   leaderboard API on Netlify Functions + Netlify Blobs
scripts/build.mjs             copies public/ to dist/ and fills in the site URL for link previews
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
3. In Site configuration, Environment variables, add `RUN_SECRET` with a long random value (at least 16 characters). Without it the leaderboard answers "not configured".
4. Deploy. Netlify Blobs needs no setup.

## Local checks

```
npm install
npm test                     # API tests
npm run build
node test/devserver.mjs      # serves dist/ and the API on http://localhost:8787
```
