// Copies public/ to dist/ and fills in the site URL for the social preview tags.
// Netlify sets URL to the site's main address at build time.
import { cp, readFile, writeFile, rm } from 'node:fs/promises';
const site = (process.env.URL || '').replace(/\/+$/, '');
await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', html.replaceAll('__SITE_URL__', site));
console.log(`built dist/ for ${site || '(no URL set: preview tags use relative paths)'}`);
