// Builds dist/ from src/: inlines the game engine and the Optimum logo into one HTML page,
// adds the head (meta, social preview tags) and copies the static files from public/.
import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';

const site = (process.env.URL || '').replace(/\/+$/, '');
const [game, stages, quiz, core, logo] = await Promise.all(['src/game.html', 'src/stages.js', 'src/quiz.js', 'src/core.js', 'src/logo.svg'].map((f) => readFile(f, 'utf8')));

const logoSvg = logo.replaceAll('#3D4047', 'currentColor');
const paths = [...logoSvg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (!paths.length) throw new Error('logo.svg has no <path d=...>');
const markSvg = `<svg viewBox="0 7 37 21" aria-hidden="true"><path d="${paths[0]}" fill="currentColor"/></svg>`;

let body = game
  .replace('<!--MARK-->', markSvg)
  .replace('<!--LOGO-->', logoSvg.replace('<svg ', '<svg class="logo" aria-label="Optimum" role="img" '))
  .replaceAll('__MARKPATH__', paths[0])
  .replaceAll('__LOGOPATHALL__', paths.join(' '))
  .replace('/*__CORE__*/', () => stages + '\n' + quiz + '\n' + core); // stages.js defines the campaign before the engine reads it

const cut = body.indexOf('</style>') + '</style>'.length;
const headPart = body.slice(0, cut), bodyPart = body.slice(cut);
const titleLine = headPart.slice(0, headPart.indexOf('\n'));
const headRest = headPart.slice(headPart.indexOf('\n') + 1).replace('<style>', '<style>\nhtml, body { margin: 0; }');
const abs = (p) => (site ? site + p : p);
const meta = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="description" content="Hire the Optimum crew, crack coded armor with independent shards and hold the validator mesh across ten campaign stages, from Hoodi Testnet to Mainnet, answering Optimum quiz questions for boosts. A fan made tower defense game. Speed is money.">
<meta name="theme-color" content="#0e0f12">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Gossip Siege">
<meta property="og:type" content="website">
<meta property="og:title" content="Gossip Siege · Speed is money">
<meta property="og:description" content="Ten stages from Hoodi Testnet to Mainnet, each built on one Optimum idea. Hire the Optimum crew and crack coded armor with independent shards.">
<meta property="og:image" content="${abs('/og.png')}">
<meta property="og:url" content="${abs('/')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Gossip Siege · Speed is money">
<meta name="twitter:description" content="A fan made Optimum tower defense game. Crack coded armor with independent shards.">
<meta name="twitter:image" content="${abs('/og.png')}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
`;
const page = `<!doctype html>\n<html lang="en">\n<head>\n${meta}${titleLine}\n${headRest}\n</head>\n<body>${bodyPart}\n</body>\n</html>\n`;

// refuse to ship a page whose scripts do not parse
for (const [, code] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try { new Function(code); } catch (e) { console.error('Build stopped: a page script does not parse:', e.message); process.exit(1); }
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
for (const ph of ['__MARKPATH__', '__LOGOPATHALL__', '<!--MARK-->', '<!--LOGO-->', '/*__CORE__*/']) if (page.includes(ph)) { console.error('Build stopped: placeholder left in page: ' + ph); process.exit(1); }
await writeFile('dist/index.html', page);
console.log(`built dist/index.html (${(page.length / 1024).toFixed(0)} KB) for ${site || 'relative URLs'}`);
