#!/usr/bin/env node
/* ============================================================
   사이트맵 만들기 — 인물 15,511 · 작품 17,061
   scripts/sitemap-build.mjs                      2026-08-19
   ------------------------------------------------------------
   ★ 왜 만드나
     지금 sitemap.xml 에는 <b>목록 화면 129개</b>만 있습니다.
     정작 자산인 상세 화면이 빠져 있어, 구글이 3만 개가 넘는
     인물·작품 화면을 찾아낼 길이 없습니다.

   ★ 손으로 적을 수 없습니다 — 인물은 주마다 늘어납니다.
     그래서 <b>DB 를 읽어 만들어</b> 냅니다.

   ★★ 갈래별로 <b>나눕니다</b>
       sitemap.xml            목차 (아래 셋을 가리킵니다)
       sitemap-pages.xml      목록·안내 화면 (지금 것을 그대로 옮김)
       sitemap-person.xml     인물
       sitemap-work.xml       작품
     한 파일에 5만 개까지 넣을 수 있지만 나누는 편이 낫습니다 —
     <b>어느 갈래가 색인되고 어느 갈래가 막혔는지</b> 서치 콘솔에서
     따로 보입니다.

   ★ 담는 기준
     인물 — <b>숨기지 않은 사람만</b>. 자료가 모자라 감춘 사람을
            구글에 알리면 빈약한 화면이 색인됩니다.
     작품 — 제목이 있는 것만.

   ★ lastmod 는 <b>넣지 않습니다.</b> 자료가 언제 바뀌었는지
     정확히 알 수 없는데 날짜를 적으면 구글이 그것을 믿고
     다시 오지 않습니다. 없는 편이 낫습니다.

   쓰는 법
     node scripts/sitemap-build.mjs            만들어 보고 세기만
     node scripts/sitemap-build.mjs --save     파일로 씁니다
   ============================================================ */

import { writeFileSync, readFileSync, existsSync } from 'fs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
            || process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.SUPABASE_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('SUPABASE_URL · 키가 필요합니다');
  process.exit(1);
}

const SITE = 'https://opusclam.com';
const SAVE = process.argv.includes('--save');

const HDR = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

/* ★ PostgREST 는 한 번에 <b>200줄</b>까지만 줍니다(요청값과 무관).
     받은 수만큼 offset 을 밀고, 0줄이면 끝냅니다. */
async function getAll(path, label) {
  const out = [];
  let off = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}&limit=1000&offset=${off}`, { headers: HDR });
    if (!r.ok) throw new Error(`${label} — Supabase ${r.status} ${(await r.text()).slice(0, 120)}`);
    const rows = await r.json();
    if (!rows || !rows.length) break;
    out.push(...rows);
    off += rows.length;
    if (out.length % 5000 === 0) console.log(`   ${label} ${out.length}개…`);
    if (off > 200000) break;                 /* 만일의 되돌이 막기 */
  }
  return out;
}

function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlset(items) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + items.map(u =>
        `  <url><loc>${xmlEsc(u.loc)}</loc>`
        + (u.freq ? `<changefreq>${u.freq}</changefreq>` : '')
        + (u.pri ? `<priority>${u.pri}</priority>` : '')
        + '</url>').join('\n')
    + '\n</urlset>\n';
}

function indexOf(files) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + files.map(f => `  <sitemap><loc>${SITE}/${f}</loc></sitemap>`).join('\n')
    + '\n</sitemapindex>\n';
}

async function main() {
  console.log('■ 사이트맵 만들기');
  console.log(`   ${SAVE ? '파일로 씁니다 (--save)' : '세기만 합니다 — 쓰려면 --save'}`);

  /* ── ① 목록 화면 — 지금 sitemap.xml 을 그대로 옮깁니다 ──
       ★ 손으로 쌓아 온 것이라 <b>다시 만들지 않습니다.</b>
         목차로 바뀌기 전에 옮겨 두어야 잃지 않습니다. */
  let pages = [];
  if (existsSync('sitemap.xml')) {
    const cur = readFileSync('sitemap.xml', 'utf8');
    if (cur.includes('<sitemapindex')) {
      console.log('   sitemap.xml 이 이미 목차입니다 — sitemap-pages.xml 을 그대로 둡니다');
      pages = null;                          /* 손대지 않습니다 */
    } else {
      const locs = [...cur.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      pages = locs.map(loc => ({ loc, freq: 'weekly', pri: '0.8' }));
      console.log(`   목록 화면 ${pages.length}개를 옮깁니다`);
    }
  }

  /* ── ② 인물 — 숨기지 않은 사람만 ─────────────────────── */
  console.log('   인물을 읽습니다…');
  const ps = await getAll('persons?select=id&hidden=not.is.true&order=id', '인물');
  console.log(`   인물 ${ps.length}명`);

  /* ── ③ 작품 — 제목이 있는 것만 ───────────────────────── */
  console.log('   작품을 읽습니다…');
  const ws = await getAll('person_works?select=id&order=id', '작품');
  console.log(`   작품 ${ws.length}건`);

  const personUrls = ps.map(p => ({
    loc: `${SITE}/db/person-view.html?id=${p.id}`, freq: 'monthly', pri: '0.7' }));
  const workUrls = ws.map(w => ({
    loc: `${SITE}/db/work-view.html?id=${w.id}`, freq: 'monthly', pri: '0.6' }));

  console.log('');
  console.log('── 만들어질 것 ──');
  if (pages) console.log(`   sitemap-pages.xml    ${pages.length}개`);
  console.log(`   sitemap-person.xml   ${personUrls.length}개`);
  console.log(`   sitemap-work.xml     ${workUrls.length}개`);
  console.log(`   sitemap.xml          목차`);
  console.log(`   ─────────────────────────`);
  console.log(`   모두                 ${(pages ? pages.length : 0) + personUrls.length + workUrls.length}개`);

  if (!SAVE) {
    console.log('');
    console.log('※ 쓰지 않았습니다. --save 를 주십시오.');
    return;
  }

  if (pages) writeFileSync('sitemap-pages.xml', urlset(pages));
  writeFileSync('sitemap-person.xml', urlset(personUrls));
  writeFileSync('sitemap-work.xml', urlset(workUrls));
  writeFileSync('sitemap.xml', indexOf(
    ['sitemap-pages.xml', 'sitemap-person.xml', 'sitemap-work.xml']));

  console.log('');
  console.log('▶ 썼습니다. 서치 콘솔에는 sitemap.xml 하나만 제출하면 됩니다 —');
  console.log('  목차를 읽고 나머지 셋을 저절로 찾아갑니다.');
}

main().catch(e => { console.error('멈춤:', e.message); process.exit(1); });
