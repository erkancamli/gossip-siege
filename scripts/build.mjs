// Builds dist/ from src/: inlines the game engine and the Optimum logo into one HTML page,
// adds the head (meta, social preview tags) and copies the static files from public/.
import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const site = (process.env.URL || '').replace(/\/+$/, '');
const [game, stages, quiz, core, logo, quizTr, contentTr] = await Promise.all(['src/game.html', 'src/stages.js', 'src/quiz.js', 'src/core.js', 'src/logo.svg', 'src/i18n-quiz-tr.js', 'src/i18n-content-tr.js'].map((f) => readFile(f, 'utf8')));

const logoSvg = logo.replaceAll('#3D4047', 'currentColor');
const paths = [...logoSvg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (!paths.length) throw new Error('logo.svg has no <path d=...>');
const markSvg = `<svg viewBox="0 7 37 21" aria-hidden="true"><path d="${paths[0]}" fill="currentColor"/></svg>`;

let body = game
  .replace('<!--MARK-->', markSvg)
  .replace('<!--LOGO-->', logoSvg.replace('<svg ', '<svg class="logo" aria-label="Optimum" role="img" '))
  .replaceAll('__MARKPATH__', paths[0])
  .replaceAll('__LOGOPATHALL__', paths.join(' '))
  .replace('/*__CORE__*/', () => [stages, quiz, quizTr, contentTr, core].join('\n')); // stages.js defines the campaign before the engine reads it; the Turkish text rides along

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

// The game code ships as one external, content hashed, immutable file: the HTML stays small (the title shows
// at once) and a reload reuses the cached script instead of downloading 350 KB again. The body's inline scripts
// are concatenated in order; the tiny head script (day or night before paint) stays inline.
const scripts = [...bodyPart.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const js = scripts.join('\n;\n');
const hash = createHash('sha256').update(js).digest('hex').slice(0, 10);
const jsName = `game-${hash}.js`;
let shipped = page.replace(bodyPart, bodyPart.replace(/<script>[\s\S]*?<\/script>\s*/g, '').replace('</div>\n\n\n', `</div>\n<script src="/${jsName}" defer></script>\n`));
if (!shipped.includes(jsName)) shipped = page.replace(bodyPart, bodyPart.replace(/<script>[\s\S]*?<\/script>\s*/g, '') + `\n<script src="/${jsName}" defer></script>`);
await writeFile('dist/' + jsName, js);
await writeFile('dist/index.html', shipped);
console.log(`built dist/index.html (${(shipped.length / 1024).toFixed(0)} KB) + ${jsName} (${(js.length / 1024).toFixed(0)} KB) for ${site || 'relative URLs'}`);
