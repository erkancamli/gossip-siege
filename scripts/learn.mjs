// Crawlable study pages built from the verified quiz bank: one page per campaign stage (each stage is one Optimum
// idea), in English and Turkish, plus an index, sitemap.xml and robots.txt. Search engines see real text with
// sources; players get a reading list that sends them back into the game. Nothing here is invented: every line
// comes from src/quiz.js, src/stages.js and their Turkish files.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';

export async function buildLearn({ site, outDir = 'dist', ogUrl }) {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['src/stages.js', 'src/i18n-content-tr.js', 'src/quiz.js', 'src/i18n-quiz-tr.js']) vm.runInContext(await readFile(f, 'utf8'), ctx);
  const STAGES = ctx.TD_STAGES, ST_TR = ctx.TD_CONTENT_TR.stages, { Q, SRC, VERIFIED } = ctx.TD_QUIZ, Q_TR = ctx.TD_QUIZ_TR;
  const today = new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const abs = (p) => site + p;
  const L = {
    en: {
      dir: '/learn/', other: 'tr', home: '/', homeName: 'Gossip Siege', lang: 'en',
      idxTitle: 'Learn Optimum and mump2p: the Gossip Siege study guide',
      idxDesc: `${Q.length} questions on Optimum, mump2p, RLNC and the Optimum gateway, each with its answer, a short explanation and the public source it was checked against. Grouped by the ten Gossip Siege stages.`,
      idxH1: 'Learn Optimum, one idea per stage',
      idxLede: `Every stage of Gossip Siege is built on one documented Optimum idea, and every quiz question in the game is checked against a public source. This guide lists all ${Q.length} questions with their answers, explanations and sources, so you can read up before you play. Last checked ${VERIFIED}.`,
      topicTitle: (s, n) => `${s.name}: ${s.sub}. ${n} Optimum questions explained`,
      topicDesc: (s, n) => `${s.optimum} ${n} questions with answers and sources, from the Gossip Siege study guide.`,
      stageLine: (s) => `Stage ${s.id}, ${s.tier}`,
      answer: 'Answer', why: 'Why', source: 'Source', play: 'Play this stage in Gossip Siege', playShort: 'Play Gossip Siege', back: 'All stages', rule: 'In the game', coach: 'Stage guide',
      count: (n) => `${n} questions`, langName: 'Türkçe',
      fine: 'Fan made for the Optimum community by @ekinoks_26, not an official Optimum product. Answers follow the linked public sources; check them for the latest numbers.',
      crumbs: ['Gossip Siege', 'Learn Optimum'],
    },
    tr: {
      dir: '/tr/learn/', other: 'en', home: '/', homeName: 'Gossip Siege', lang: 'tr',
      idxTitle: "Optimum ve mump2p'yi öğren: Gossip Siege çalışma rehberi",
      idxDesc: `Optimum, mump2p, RLNC ve Optimum gateway üzerine ${Q.length} soru; her biri cevabı, kısa açıklaması ve doğrulandığı herkese açık kaynakla. Gossip Siege'in on bölümüne göre gruplandı.`,
      idxH1: "Optimum'u öğren, her bölümde bir fikir",
      idxLede: `Gossip Siege'in her bölümü belgelenmiş bir Optimum fikri üzerine kurulu ve oyundaki her quiz sorusu herkese açık bir kaynağa göre kontrol edildi. Bu rehber ${Q.length} sorunun hepsini cevabı, açıklaması ve kaynağıyla listeliyor; oynamadan önce okuyabilirsin. Son kontrol ${VERIFIED}.`,
      topicTitle: (s, n) => `${s.name}: ${s.sub}. ${n} Optimum sorusu açıklamalı`,
      topicDesc: (s, n) => `${s.optimum} Cevapları ve kaynaklarıyla ${n} soru, Gossip Siege çalışma rehberinden.`,
      stageLine: (s) => `${s.id}. bölüm, ${({ Beginner: 'Başlangıç', Intermediate: 'Orta', Advanced: 'İleri', Expert: 'Uzman', Master: 'Usta' })[s.tier] || s.tier}`,
      answer: 'Cevap', why: 'Neden', source: 'Kaynak', play: "Bu bölümü Gossip Siege'de oyna", playShort: "Gossip Siege'i oyna", back: 'Tüm bölümler', rule: 'Oyunda', coach: 'Bölüm rehberi',
      count: (n) => `${n} soru`, langName: 'English',
      fine: "Optimum topluluğu için @ekinoks_26 tarafından yapılmış bir hayran oyunu, resmi bir Optimum ürünü değil. Cevaplar bağlantısı verilen herkese açık kaynaklara dayanıyor; en güncel rakamlar için kaynaklara bak.",
      crumbs: ['Gossip Siege', "Optimum'u öğren"],
    },
  };
  const stageText = (s, lang) => {
    if (lang === 'en') return { name: s.name, sub: s.sub, optimum: s.optimum, rule: s.rule, tier: s.tier, id: s.id, key: s.key, guide: s.guide };
    const t = ST_TR[s.key] || {};
    return { name: s.name, sub: t.sub || s.sub, optimum: t.optimum || s.optimum, rule: t.rule || s.rule, tier: s.tier, id: s.id, key: s.key, guide: s.guide && { name: s.guide.name, note: t.guide || s.guide.note } };
  };
  const qText = (q, lang) => (lang === 'tr' && Q_TR[q.id] ? { q: Q_TR[q.id].q || q.q, a: (Q_TR[q.id].a || q.a)[0], why: Q_TR[q.id].why || q.why } : { q: q.q, a: q.a[0], why: q.why });
  const byStage = STAGES.map((s) => ({ s, qs: Q.filter((q) => q.tag === s.key) }));
  const urlOf = (lang, key) => L[lang].dir + (key ? key + '/' : '');

  const css = `:root{--ink:#0e0f12;--slab:#16181d;--line:#2a2d35;--paper:#e8eaed;--dim:#9aa0aa;--gold:#ffd23f;--cyan:#3cc8f0}
@media (prefers-color-scheme:light){:root{--ink:#f4f5f7;--slab:#ffffff;--line:#dcdfe5;--paper:#15171b;--dim:#5b616c;--gold:#b88400;--cyan:#0b7fa6}}
*{box-sizing:border-box}html{background:var(--ink);color:var(--paper);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}body{margin:0}
main,header,footer{max-width:820px;margin:0 auto;padding:0 18px}header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:18px;font-weight:600}
a{color:var(--cyan)}header a{color:var(--paper);text-decoration:none}nav.crumbs{font-size:13px;color:var(--dim);margin:18px 0 6px}nav.crumbs a{color:var(--dim)}
h1{font-size:clamp(26px,5vw,36px);line-height:1.15;margin:6px 0 12px}h2{font-size:18px;line-height:1.35;margin:0 0 8px}.lede{color:var(--dim);font-size:17px}
.cta{display:inline-block;margin:10px 0 22px;padding:11px 18px;border-radius:12px;background:var(--gold);color:#111;font-weight:700;text-decoration:none;box-shadow:0 3px 0 #a07a00}
.box{background:var(--slab);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:12px 0}.ans{margin:4px 0}.ans b{color:var(--gold)}.why{margin:6px 0;color:var(--paper)}.src{font-size:13px;color:var(--dim);margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:0;list-style:none}.grid a{display:block;height:100%;text-decoration:none;color:var(--paper)}.grid small{color:var(--dim)}
.meta{font-size:13px;color:var(--dim)}footer{color:var(--dim);font-size:13px;padding:28px 18px 40px;border-top:1px solid var(--line);margin-top:30px}.more{padding-left:18px}`;

  const page = ({ lang, path, title, desc, h1, body, jsonld, alt }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
<link rel="alternate" hreflang="${lang}" href="${abs(path)}">
<link rel="alternate" hreflang="${L[lang].other}" href="${abs(alt)}">
<link rel="alternate" hreflang="x-default" href="${abs(lang === 'en' ? path : alt)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Gossip Siege">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${ogUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogUrl}">
<meta name="theme-color" content="#0e0f12">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header><a href="/">Gossip Siege</a><a href="${alt}" hreflang="${L[lang].other}">${L[lang].langName}</a></header>
<main>
${body}
</main>
<footer>${esc(L[lang].fine)} <a href="https://www.getoptimum.xyz" rel="noopener">getoptimum.xyz</a> · <a href="${L[lang].dir}">${esc(L[lang].crumbs[1])}</a> · <a href="/">${esc(L[lang].playShort)}</a></footer>
</body>
</html>
`;
  const crumbLd = (lang, items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })) });
  const sitemap = [];
  for (const lang of ['en', 'tr']) {
    const T = L[lang];
    // index
    const cards = byStage.map(({ s, qs }) => { const st = stageText(s, lang); return `<li><a class="box" href="${urlOf(lang, s.key)}"><span class="meta">${esc(T.stageLine(st))} · ${esc(T.count(qs.length))}</span><h2>${esc(st.name)}</h2><small>${esc(st.sub)}</small></a></li>`; }).join('\n');
    const idxPath = urlOf(lang), idxAlt = urlOf(T.other);
    await mkdir(outDir + idxPath, { recursive: true });
    await writeFile(outDir + idxPath + 'index.html', page({
      lang, path: idxPath, alt: idxAlt, title: T.idxTitle, desc: T.idxDesc,
      body: `<nav class="crumbs"><a href="/">${esc(T.crumbs[0])}</a> › ${esc(T.crumbs[1])}</nav>\n<h1>${esc(T.idxH1)}</h1>\n<p class="lede">${esc(T.idxLede)}</p>\n<a class="cta" href="/">${esc(T.playShort)}</a>\n<ul class="grid">${cards}</ul>`,
      jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: T.idxTitle, description: T.idxDesc, url: abs(idxPath), inLanguage: lang, isPartOf: { '@type': 'WebSite', name: 'Gossip Siege', url: abs('/') }, about: { '@type': 'Thing', name: 'Optimum mump2p' }, hasPart: byStage.map(({ s }) => ({ '@type': 'WebPage', name: stageText(s, lang).name, url: abs(urlOf(lang, s.key)) })) }, crumbLd(lang, [[T.crumbs[0], '/'], [T.crumbs[1], idxPath]])] },
    }));
    if (lang === 'en') sitemap.push({ en: urlOf('en'), tr: urlOf('tr'), pri: '0.8' });
    // one page per stage
    for (const { s, qs } of byStage) {
      const st = stageText(s, lang), path = urlOf(lang, s.key), alt = urlOf(T.other, s.key);
      const items = qs.map((q) => { const t = qText(q, lang), src = SRC[q.src]; return `<article class="box" id="${esc(q.id)}"><h2>${esc(t.q)}</h2><p class="ans"><b>${esc(T.answer)}:</b> ${esc(t.a)}</p><p class="why">${esc(t.why)}</p>${src ? `<p class="src">${esc(T.source)}: <a href="${esc(src.url)}" rel="noopener">${esc(src.label)}</a></p>` : ''}</article>`; }).join('\n');
      const others = byStage.filter((x) => x.s.key !== s.key).map((x) => `<li><a href="${urlOf(lang, x.s.key)}">${esc(stageText(x.s, lang).name)}</a>: ${esc(stageText(x.s, lang).sub)}</li>`).join('');
      const rule = st.rule ? `<p class="meta"><b>${esc(T.rule)}:</b> ${esc(st.rule.name)}. ${esc(st.rule.text)}</p>` : '';
      const coach = st.guide ? `<p class="meta"><b>${esc(T.coach)}:</b> ${esc(st.guide.name)}, ${esc(st.guide.note)}</p>` : '';
      await mkdir(outDir + path, { recursive: true });
      await writeFile(outDir + path + 'index.html', page({
        lang, path, alt, title: T.topicTitle(st, qs.length) + ' | Gossip Siege', desc: T.topicDesc(st, qs.length).slice(0, 300),
        body: `<nav class="crumbs"><a href="/">${esc(T.crumbs[0])}</a> › <a href="${urlOf(lang)}">${esc(T.crumbs[1])}</a> › ${esc(st.name)}</nav>\n<p class="meta">${esc(T.stageLine(st))} · ${esc(T.count(qs.length))}</p>\n<h1>${esc(st.name)}: ${esc(st.sub)}</h1>\n<p class="lede">${esc(st.optimum)}</p>\n${rule}${coach}<a class="cta" href="/">${esc(T.play)}</a>\n${items}\n<h2>${esc(T.back)}</h2><ul class="more">${others}</ul>`,
        jsonld: { '@context': 'https://schema.org', '@graph': [
          { '@type': 'FAQPage', name: T.topicTitle(st, qs.length), url: abs(path), inLanguage: lang, mainEntity: qs.map((q) => { const t = qText(q, lang); return { '@type': 'Question', name: t.q, acceptedAnswer: { '@type': 'Answer', text: `${t.a}. ${t.why}` } }; }) },
          crumbLd(lang, [[T.crumbs[0], '/'], [T.crumbs[1], urlOf(lang)], [st.name, path]]),
        ] },
      }));
      if (lang === 'en') sitemap.push({ en: urlOf('en', s.key), tr: urlOf('tr', s.key), pri: '0.7' });
    }
  }
  // sitemap with language alternates, and robots.txt pointing at it
  const urlXml = (loc, alts, pri) => `<url><loc>${abs(loc)}</loc><lastmod>${today}</lastmod><priority>${pri}</priority>${alts.map(([l, p]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(p)}"/>`).join('')}</url>`;
  const entries = [urlXml('/', [], '1.0')];
  for (const e of sitemap) for (const lang of ['en', 'tr']) entries.push(urlXml(e[lang], [['en', e.en], ['tr', e.tr], ['x-default', e.en]], e.pri));
  await writeFile(outDir + '/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
  await writeFile(outDir + '/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${abs('/sitemap.xml')}\n`);
  return { pages: 2 + byStage.length * 2, urls: entries.length };
}
