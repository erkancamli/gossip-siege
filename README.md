# Gossip Siege

A fan made tower defense game for the [Optimum](https://www.getoptimum.xyz) community. Hire the Optimum crew, crack coded armor with independent shards and take the validator mesh from Hoodi Testnet to Mainnet across ten campaign stages, learning how Optimum works along the way. Speed is money.

Not an official Optimum product.

## How the RLNC idea shows up in play

Coded enemies wear a shield with k segments. It only breaks after hits from k different crew members, the same way a block coded with Random Linear Network Coding only decodes once k independent shards arrive. Repeat hits from one tower are redundant copies. Muriel, the Recoder, remixes the shots of nearby crew so every hit counts as new, like an RLNC relay recoding shards without decoding them.

## Campaign

Ten stages. Clearing one unlocks the next. Each stage has its own map and look and adds one rule taken from a documented Optimum idea. Stars depend on validators left: 18 or more for three, 10 or more for two.

| # | Stage | Waves | Rule | Optimum idea |
| --- | --- | --- | --- | --- |
| 1 | Hoodi Testnet | 12 | none, learn the crew | rollout on Ethereum's Hoodi testnet, about 150 ms average block propagation |
| 2 | Copy Storm | 14 | Dupe swarms 2.5x larger | Gossipsub forwards full copies; mump2p claims 90 to 95% less bandwidth |
| 3 | Shard Threshold | 15 | every enemy coded into 4 shards, shield opens at 75% | shard factor 4, threshold 0.75 |
| 4 | Blob Season | 16 | Hogs burst into 3 Dupes, shields need one more shard | blobs; Gossipsub failed at 4 MB in A/B tests, mump2p carried 10 MB |
| 5 | Mesh Limits | 17 | at most 12 crew, +15% fire rate from 6 crew | mesh target 6, min 4, max 12 |
| 6 | Subsea Cable | 18 | lossy stretch drops 30% of plain shots, coded shots survive | RLNC loss tolerance, Flexnode coded buffers |
| 7 | Flexnode Grid | 19 | Flexnode pads: +25% fire rate, every shot coded | Flexnodes encode, decode and recode RLNC frames |
| 8 | The Gateway | 20 | all enemies coded from wave 6, every hit past the Gateway is coded | Optimum Gateway bridges Prysm, Lighthouse, Nimbus, Teku and Lodestar with no client changes |
| 9 | Stress Test | 22 | the route is the Optimum infinity mark; twice the enemies, lighter, half bounty | about 10x lower latency under high traffic and zero loss in A/B tests |
| 10 | Mainnet | 25, then endless | leaks cost coins, early waves pay double | speed is money |

## The crew

The seven heroes are named after the Optimum team, and every stage has a guide from the team. Sources: getoptimum.xyz/team, getoptimum.xyz/blog, the OptimumP2P paper (arXiv 2508.04833) and the public getoptimum GitHub repos. The game only states public facts about them and invents no quotes.

| Hero | Role | Named after |
| --- | --- | --- |
| Kishori | Encoder | Dr. Kishori Konwar, co-founder |
| Jeff | Flood Breaker | Jeff (@blockchainjeff), community manager |
| Nancy | Throttle | Prof. Nancy Lynch, advisor |
| Swarna | Long Haul | Swarnabha Sinha, OptimumP2P paper co-author, author of the Hoodi 6x latency analysis |
| Muriel | Recoder | Prof. Muriel Médard, co-founder and CEO, co-inventor of RLNC |
| Sajida | Flexnode Bank | Sajida Zouarhi, author of the PBS hot path research, co-author of the staking revenue study |
| Sriram | Decoder | Prof. Sriram Viswanath, advisor |

Community: Pegasus, the Discord mumbassador, is the in game coach and quiz host. Flash, who assigns roles in the Discord, grades the campaign and assigns the Discord roles from stars and learned answers: Optimum Newbie, Observer (3 stars and 3 answers), Refined (9 stars and 10 answers), then at 21 stars and 25 answers either Optimized (stars lead, the active players) or Chronicler (knowledge leads, the creative ones); the role goes on the share card.

Stage guides: Nicolas Nicolaou (Hoodi Testnet), Aayush Rajasekaran (Copy Storm), Onyeka Obi (Shard Threshold), Aleksandr Bezobchuk (Blob Season), Har Preet Singh (Mesh Limits), Santiago Paiva (Subsea Cable), Michael Meier (Flexnode Grid), Alejandro Bergasov (The Gateway), Prof. Sriram Viswanath (Stress Test), Moritz Grundei (Mainnet).

## Optimum quiz

Before each stage a three question briefing on that stage's topic pays starting coins. During play, every second wave a question appears while the battle slows down. Answer within 15 seconds for a reward that rotates between coins, a free Flexnode Surge, a recharged Publish Burst and extra validators; faster answers pay more and three right in a row doubles it. Every answer shows a short explanation and its source. Questions use spaced repetition (the Leitner method behind apps like Duolingo): a missed question comes back two questions later, a known one waits longer each time, so runs keep changing. The Optimum knowledge screen shows every learned answer and mastery per topic. The question bank lives in `src/quiz.js`, and every question cites one of: getoptimum.xyz, the Optimum docs, the optimum-gateway README, the OptimumP2P testnet announcement or ethereum.org, and carries the date it was last checked. Claims that can change (numbers, roles, product status) are flagged `vol: true` and re-checked first by a weekly refresh task.

Each stage has its own leaderboard. Difficulty is tuned against three simulated players on the real engine: a casual one (random pads, one purchase per wave), a smart one (pads ranked by route coverage, upgrades the busiest hero first) and the smart one answering the quiz. The target ramp: Beginner stages are cleared by everyone, Intermediate stages cost the casual player lives, Advanced stages need smart placement, Expert stages need smart placement plus quiz boosts, and Mainnet needs level 4 specializations on top (`node src/bot.cjs [stage]` for the optimized bot).

## Crew upgrades

Every crew member has four levels, the Kingdom Rush pattern. Levels 1 to 3 raise damage, fire rate and range, and the weapon visibly grows: bigger, brighter projectiles with longer trails, more shards per volley, shoulder pads, then a halo. At level 4 each crew member picks one of two specializations with a completely different weapon and gets a cape and crown in its colour.

| Crew | Level 4 A | Level 4 B |
| --- | --- | --- |
| Kishori, Encoder | Fountain Coder: every shard counts as independent | Railshard: pierces 6 enemies, ignores armor |
| Jeff, Flood Breaker | Cluster Flood: blasts split into 4 bomblets | Firewall: leaves a burning zone on the path |
| Nancy, Throttle | Rate Limiter: every 4th pulse freezes | Peer Scoring: marked enemies take +35% damage |
| Swarna, Long Haul | Global Relay: map wide, 40% triple crits | Shrapnel Lance: bursts into 6 fragments |
| Muriel, Recoder | Mesh Amplifier: bigger aura, +85% crew speed | Chain Recoder: zap chains across 5 enemies |
| Kent, Flexnode Bank | Validator Fund: 130 per wave, 8% interest | MEV Hunter: throws gold, +3 coins per kill nearby |
| Sriram, Decoder | Decode Ray: the beam burns through a line | Twin Decoder: two beams, decodes below 30% |

Upgrade buttons show every stat as "now → next" before you buy, and each damage dealing crew member has a target priority (First, Last, Strong, Close).

## Project layout

```
src/stages.js                 campaign stages: routes, pads, rules, difficulty
src/quiz.js                   Optimum question bank with sources
src/i18n-quiz-tr.js           Turkish text for every question, keyed by question id
src/i18n-content-tr.js        Turkish text for stages, crew, enemies and the tutorial
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
| `/api/scores?stage=n` | GET | Top 50 of a stage (1 to 10), best score per X handle |
| `/api/scores` | POST | Submit a finished run (with its stage); needs a Privy access token from an X login |
| `/api/privy` | GET | The Privy app id the page uses for sign in with X |

Scores on the shared board belong to X accounts: the page signs the player in with X through Privy, sends the Privy access token with the run, and the function verifies the token (ES256, `PRIVY_VERIFICATION_KEY`) and reads the X username from Privy, so the handle on the board is the real one. On top of that: a server signed ticket per run, a minimum real play time per wave, a score ceiling derived from the game's own scoring, one ticket per handle, and a short rate limit per client. Until the Privy variables are set the board is read only and the page says sign in is being set up.

## Deploy on Netlify

1. Import this repository in Netlify (Add new site, Import an existing project, GitHub).
2. Build settings are read from `netlify.toml`; nothing to change.
3. Deploy. Netlify Blobs needs no setup, and the leaderboard generates its own signing secret on first use. Setting `RUN_SECRET` (16+ random characters) in the environment variables is optional and overrides it.
4. Sign in with X: create an app at dashboard.privy.io, enable Twitter (X) as a login method, add the site's URL under allowed origins, and set these environment variables in Netlify: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY` (the app's verification key from the Privy dashboard, PEM) and, if the app has a web client, `PRIVY_CLIENT_ID`. Redeploy afterwards.

## Local checks

```
npm install
npm test                     # API tests
npm run build
node test/devserver.mjs      # serves dist/ and the API on http://localhost:8787
```

## Language, day, night and mobile

The game runs in English or Turkish. The first visit follows the browser language; the TR / EN button on the title screen and in the HUD switches at any time, including mid run, and the choice is kept on the device. Everything a player reads is translated, including the stage rules, the crew cards, the tutorial and all 100 quiz questions with their explanations. Share text, the score card and X posts stay in English so the community reads one language on X.


A day and night switch sits in the HUD and on the title screen; the first visit follows the system setting. On phones in landscape the HUD, quiz and menus grow so they stay readable and tappable; portrait shows a rotate prompt. Android and tablets get a full screen button, and iOS can add the game to the home screen.
