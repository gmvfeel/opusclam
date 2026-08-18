/* ════════════════════════════════════════════════════════════════
   sitemap.xml 을 세 말(한국어·영어·일본어)로 넓혀 다시 씁니다
   ────────────────────────────────────────────────────────────────
   실행:  node scripts/build-sitemap.mjs
   결과:  sitemap.xml 을 덮어씁니다

   ★ 왜 손으로 적지 않고 이 파일을 두는가
     화면 51개 × 세 말 = 153 줄입니다. 손으로 적으면 새 화면을 열
     때마다 세 군데를 고쳐야 하고, 한 곳을 빠뜨리면 hreflang 이
     서로 어긋나 <b>구글이 통째로 무시합니다.</b>
     주소는 아래 PAGES 한 곳에만 적고, 나머지는 이 파일이 만듭니다.

   ★ hreflang 의 규칙 — 서로 가리켜야 합니다
     한국어 판이 영어 판을 「내 다른 말 판」이라 하면,
     <b>영어 판도 한국어 판을 똑같이 가리켜야</b> 합니다.
     한쪽만 가리키면 구글은 그 짝을 버립니다. 그래서 세 판 모두에
     같은 목록을 넣습니다.

   ★ 영어·일본어에서 감춘 화면은 그 말의 sitemap 에 넣지 않습니다
     메뉴에서 안 보이는 화면이 검색에는 나오면 앞뒤가 맞지 않습니다.
     감출 목록은 assets/i18n.js 의 HIDE_PATH 와 <b>같아야</b> 하므로,
     이 파일이 그 파일을 직접 읽어 맞춥니다 — 두 곳에 적지 않습니다.

   ★★ 2026-08-19 · <b>상세 화면을 담습니다</b> (인물 15,509 · 작품 17,061)
     ────────────────────────────────────────────────────────────
     api/seo.js 가 봇에게만 서버에서 미리 그려 주게 되어, 이제 상세
     화면도 <b>빈 껍데기가 아닙니다.</b> 그래서 사이트맵에 넣습니다.

     ★ 파일을 <b>넷으로 나눕니다</b>
         sitemap.xml          목차
         sitemap-pages.xml    목록·안내 화면 (hreflang 그대로)
         sitemap-person.xml   인물
         sitemap-work.xml     작품
       한 파일에 5만 개까지 넣을 수 있지만 나누는 편이 낫습니다 —
       <b>어느 갈래가 색인되고 막혔는지</b> 서치 콘솔에서 따로 보입니다.

     ★ hreflang 은 <b>목록 화면에만</b> 붙입니다. 상세 화면은 한국어
       판 하나뿐이고 /en/ /ja/ 판이 따로 없습니다. 없는 주소를
       가리키면 구글이 그 짝을 통째로 버립니다.

     ★ 상세 화면에는 lastmod 를 <b>넣지 않습니다.</b> 자료가 언제
       바뀌었는지 정확히 알 수 없는데 날짜를 적으면 구글이 그것을
       믿고 다시 오지 않습니다.

     ★ 인물은 <b>숨기지 않은 사람만</b> 담습니다. 자료가 모자라 감춘
       사람을 알리면 빈약한 화면이 색인됩니다.

     ★ DB 를 읽으므로 SUPABASE_URL · 키가 있어야 합니다. 없으면
       상세 화면 없이 목록만 만듭니다 — 손으로 돌릴 때도 됩니다.
   ════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://opusclam.com';
const LANGS = ['en', 'ja'];

/* ── 담을 화면 ──────────────────────────────────────────────────
   ★ 새 메뉴를 열면 여기에 한 줄만 보태고 이 파일을 다시 돌리십시오.
   ★ 상세 화면(-view.html)은 아직 넣지 않습니다 — 내용을 자바스크립트로
     불러오므로 봇에게는 빈 껍데기입니다. 미리 그려 주게 된 뒤에 엽니다. */
const PAGES = [
  ['/',                                    'daily',   '1.0'],
  ['/home.html',                           'daily',   '1.0'],
  ['/search.html',                         'weekly',  '0.6'],

  ['/db/index.html',                       'daily',   '0.9'],
  ['/db/person.html',                      'daily',   '0.9'],
  ['/db/venue.html',                       'weekly',  '0.8'],
  ['/db/modern.html',                      'weekly',  '0.8'],
  ['/db/org.html',                         'weekly',  '0.8'],
  ['/db/school.html',                      'weekly',  '0.8'],
  ['/db/foundation.html',                  'weekly',  '0.8'],
  ['/db/work.html',                        'weekly',  '0.8'],
  ['/db/timeline.html',                    'monthly', '0.7'],
  ['/db/terms.html',                       'monthly', '0.7'],
  ['/db/academic.html',                    'weekly',  '0.8'],

  ['/community/index.html',                'daily',   '0.9'],
  ['/community/news.html',                 'daily',   '0.8'],
  ['/community/hottopic.html',             'daily',   '0.8'],
  ['/community/qna.html',                  'daily',   '0.8'],
  ['/community/prenatal.html',             'weekly',  '0.7'],
  ['/community/prenatal-playlist.html',    'weekly',  '0.7'],
  ['/community/selfpr.html',               'weekly',  '0.7'],
  ['/community/school-month.html',         'monthly', '0.7'],
  ['/community/gallery.html',              'weekly',  '0.7'],
  ['/community/modern.html',               'weekly',  '0.7'],
  ['/community/utility.html',              'weekly',  '0.7'],
  ['/community/admission.html',            'weekly',  '0.8'],
  ['/community/admission-community.html',  'weekly',  '0.7'],

  ['/spot/index.html',                     'daily',   '0.8'],
  ['/spot/concert.html',                   'daily',   '0.8'],
  ['/spot/concours.html',                  'weekly',  '0.8'],
  ['/spot/concours-price.html',            'weekly',  '0.7'],
  ['/spot/festival.html',                  'weekly',  '0.8'],
  ['/spot/funding.html',                   'weekly',  '0.7'],
  ['/spot/score.html',                     'weekly',  '0.7'],
  ['/spot/media.html',                     'weekly',  '0.7'],
  ['/spot/sites.html',                     'monthly', '0.6'],

  ['/lesson/index.html',                   'weekly',  '0.8'],
  ['/lesson/master.html',                  'weekly',  '0.7'],
  ['/lesson/open.html',                    'weekly',  '0.7'],
  ['/lesson/live.html',                    'weekly',  '0.7'],
  ['/lesson/one.html',                     'weekly',  '0.7'],
  ['/lesson/group.html',                   'weekly',  '0.7'],
  ['/lesson/instructor.html',              'weekly',  '0.7'],

  ['/recruit/guide.html',                  'monthly', '0.6'],
  ['/recruit/job.html',                    'daily',   '0.7'],
  ['/recruit/talent.html',                 'daily',   '0.7'],

  ['/shop/apply.html',                     'monthly', '0.5'],

  ['/legal/terms.html',                    'yearly',  '0.3'],
  ['/legal/privacy.html',                  'yearly',  '0.3'],
  ['/legal/data-policy.html',              'yearly',  '0.3'],
  ['/legal/data-protection.html',          'yearly',  '0.3'],
];

/* ── assets/i18n.js 에서 「그 말에서 감출 주소」 를 그대로 읽어 옵니다
      두 곳에 적으면 언젠가 갈라집니다. 한 곳만 봅니다. ────────── */
function readHidePath() {
  const src = readFileSync(join(ROOT, 'assets', 'i18n.js'), 'utf8');
  const start = src.indexOf('var HIDE_PATH');
  if (start < 0) throw new Error('i18n.js 에서 HIDE_PATH 를 찾지 못했습니다');
  const open = src.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('HIDE_PATH 의 닫는 괄호를 찾지 못했습니다');

  const body = src.slice(open, end + 1);
  const out = {};
  for (const lang of LANGS) {
    const m = new RegExp(lang + '\\s*:\\s*\\[([\\s\\S]*?)\\]').exec(body);
    if (!m) { out[lang] = []; continue; }
    /* 주석을 걷어내고 따옴표 안의 것만 거둡니다 */
    const cleaned = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
    out[lang] = [...cleaned.matchAll(/'([^']+)'|"([^"]+)"/g)].map(x => x[1] || x[2]);
  }
  return out;
}

const HIDE = readHidePath();
const hidden = (lang, path) =>
  (HIDE[lang] || []).some(p => path.startsWith(p));

/* 그 주소를 볼 수 있는 말만 추립니다 (한국어는 늘 봅니다) */
function langsFor(path) {
  return ['ko', ...LANGS.filter(l => !hidden(l, path))];
}

const href = (lang, path) => ORIGIN + (lang === 'ko' ? path : '/' + lang + path);
const today = new Date().toISOString().slice(0, 10);

/* ── 짓기 ──────────────────────────────────────────────────────── */
const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<!-- OPUSCLAM.COM 사이트맵');
lines.push('     ★ 이 파일은 scripts/build-sitemap.mjs 가 만듭니다.');
lines.push('       손으로 고치지 마십시오 — 다시 돌리면 지워집니다.');
lines.push('       새 화면을 열면 그 파일의 PAGES 에 한 줄 보태고 다시 돌리십시오.');
lines.push('       node scripts/build-sitemap.mjs');
lines.push('');
lines.push('     ★ 한국어·영어·일본어 세 판을 hreflang 으로 묶었습니다.');
lines.push('       영어·일본어에서 감춘 메뉴는 그 말의 판을 넣지 않았습니다');
lines.push('       (감출 목록은 assets/i18n.js 의 HIDE_PATH 를 그대로 읽습니다).');
lines.push('');
lines.push('     ★ 상세 화면(-view.html)은 아직 넣지 않았습니다 —');
lines.push('       내용을 자바스크립트로 불러오므로 봇에게는 빈 껍데기입니다. -->');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');

let count = 0;
for (const [path, freq, pri] of PAGES) {
  const langs = langsFor(path);
  for (const lang of langs) {
    lines.push('  <url>');
    lines.push(`    <loc>${href(lang, path)}</loc>`);
    /* 서로 가리키기 — 이 주소를 볼 수 있는 말 전부를 적습니다 */
    for (const l of langs) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${href(l, path)}"/>`);
    }
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${href('ko', path)}"/>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push(`    <changefreq>${freq}</changefreq>`);
    lines.push(`    <priority>${pri}</priority>`);
    lines.push('  </url>');
    count++;
  }
}
lines.push('</urlset>');

writeFileSync(join(ROOT, 'sitemap-pages.xml'), lines.join('\n') + '\n', 'utf8');

/* ── 알림 ──────────────────────────────────────────────────────── */
const onlyKo = PAGES.filter(([p]) => langsFor(p).length === 1).length;
console.log(`  화면 ${PAGES.length}개 → 주소 ${count}개`);
console.log(`  영어·일본어에서 감춘 화면 ${onlyKo}개는 한국어만 넣었습니다`);
for (const l of LANGS) {
  const n = PAGES.filter(([p]) => !hidden(l, p)).length;
  console.log(`    ${l} : ${n}개 (감춤 ${PAGES.length - n}개)`);
}


/* ════════════════════════════════════════════════════════════════
   상세 화면 — 인물 · 작품
   ★ DB 를 읽습니다. 키가 없으면 <b>조용히 건너뜁니다</b> —
     손으로 목록만 다시 만들 때도 돌아가야 합니다.
   ════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
            || process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.SUPABASE_ANON_KEY;

/* ★ PostgREST 는 한 번에 1,000줄까지 줍니다. 받은 수만큼 offset 을
     밀고 0줄이면 끝냅니다 — 200 상한에 걸려도 이 방식이면 맞습니다. */
async function getAll(path, label) {
  const out = [];
  let off = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}&limit=1000&offset=${off}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) throw new Error(`${label} — Supabase ${r.status} ${(await r.text()).slice(0, 120)}`);
    const rows = await r.json();
    if (!rows || !rows.length) break;
    out.push(...rows);
    off += rows.length;
    if (out.length % 5000 === 0) console.log(`    ${label} ${out.length}개…`);
    if (off > 200000) break;                    /* 만일의 되돌이 막기 */
  }
  return out;
}

/* 상세 화면 묶음 — hreflang 도 lastmod 도 없이 단순하게 */
function plainSet(urls, freq, pri, note) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<!-- ${note}\n     ★ scripts/build-sitemap.mjs 가 만듭니다. 손으로 고치지 마십시오. -->\n`
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${u}</loc>`
        + `<changefreq>${freq}</changefreq><priority>${pri}</priority></url>`).join('\n')
    + '\n</urlset>\n';
}

const parts = ['sitemap-pages.xml'];

if (!SB_URL || !SB_KEY) {
  console.log('');
  console.log('  ※ SUPABASE 키가 없어 상세 화면은 건너뜁니다 (목록만 다시 만들었습니다).');
  /* ★ 있던 상세 사이트맵을 <b>지우지 않습니다.</b> 목차에도 그대로
       남겨 두어야 이미 색인된 것을 잃지 않습니다. */
  for (const f of ['sitemap-person.xml', 'sitemap-work.xml']) {
    try { readFileSync(join(ROOT, f), 'utf8'); parts.push(f); } catch (e) { /* 없으면 뺍니다 */ }
  }
} else {
  console.log('');
  console.log('  인물을 읽습니다…');
  const ps = await getAll('persons?select=id&hidden=not.is.true&order=id', '인물');
  console.log(`  인물 ${ps.length}명`);

  console.log('  작품을 읽습니다…');
  const ws = await getAll('person_works?select=id&order=id', '작품');
  console.log(`  작품 ${ws.length}건`);

  writeFileSync(join(ROOT, 'sitemap-person.xml'), plainSet(
    ps.map(p => `${ORIGIN}/db/person-view.html?id=${p.id}`),
    'monthly', '0.7', 'OPUSCLAM.COM 인물 상세'), 'utf8');
  writeFileSync(join(ROOT, 'sitemap-work.xml'), plainSet(
    ws.map(w => `${ORIGIN}/db/work-view.html?id=${w.id}`),
    'monthly', '0.6', 'OPUSCLAM.COM 작품 상세'), 'utf8');

  parts.push('sitemap-person.xml', 'sitemap-work.xml');
}

/* ── 목차 ────────────────────────────────────────────────────────
   ★ 서치 콘솔에는 이 파일 하나만 제출하면 됩니다. */
writeFileSync(join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<!-- OPUSCLAM.COM 사이트맵 목차\n'
  + '     ★ scripts/build-sitemap.mjs 가 만듭니다. 손으로 고치지 마십시오.\n'
  + '     ★ 서치 콘솔에는 이 파일 하나만 제출하면 됩니다. -->\n'
  + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + parts.map(f => `  <sitemap><loc>${ORIGIN}/${f}</loc></sitemap>`).join('\n')
  + '\n</sitemapindex>\n', 'utf8');

console.log('');
console.log('▶ 만든 파일 : ' + ['sitemap.xml'].concat(parts).join(' · '));
