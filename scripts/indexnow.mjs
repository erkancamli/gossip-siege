// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) that every URL in the live sitemap changed.
// Run after a deploy:  node scripts/indexnow.mjs [https://gossipsiege.xyz]
const site = (process.argv[2] || 'https://gossipsiege.xyz').replace(/\/$/, '');
const key = '3e5089a8e78d70460806ea0ec0b449d1';
const xml = await (await fetch(site + '/sitemap.xml')).text();
const urlList = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))];
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} urls, HTTP ${res.status} ${await res.text()}`);
