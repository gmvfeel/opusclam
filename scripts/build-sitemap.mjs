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

/* ★★★ 2026-08-19 (파트너 물음으로 찾음) · <b>`--save` 가 아무 일도 안 하고
   있었습니다.</b>
   ══════════════════════════════════════════════════════════════
   워크플로에는 「실제로 만들어 올리기 (no 면 몇 개인지만 셉니다)」라는
   선택 칸이 있고, `yes` 면 `--save` 를 붙여 이 파일을 부릅니다.
   그런데 이 파일은 <b>argv 를 한 번도 읽지 않았습니다.</b>
   ▶ 그래서 `no` 를 골라도 파일을 다 쓰고, 워크플로 다음 걸음이
     바뀐 파일을 그대로 커밋했습니다. <b>선택 칸이 거짓말을 하고 있었습니다.</b>

   ★ 왜 고치나 — 이제 사이트맵이 4만 줄이 넘습니다. 「먼저 몇 개인지만
     세어 보기」가 실제로 되어야 합니다. 숫자가 이상한데 이미 올라가 버리면
     되돌리는 일이 늘어납니다.
   ★ 예약 실행은 워크플로가 `--save` 를 붙여 줍니다 — 그대로 만들어집니다. */
const SAVE = process.argv.includes('--save');

/* 쓰기는 한 곳으로 모읍니다 — `--save` 가 없으면 <b>세기만</b> 합니다. */
function put(path, text, label) {
  const n = (text.match(/<url>|<sitemap>/g) || []).length;
  if (SAVE) {
    writeFileSync(path, text, 'utf8');
    return;
  }
  console.log(`  (안 씀) ${label || path.split('/').pop()} — ${n}줄`);
}
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://opusclam.com';
/* ★★ 2026-08-19 — <b>['en','ja'] 에서 [] 로 비웠습니다.</b>

   왜 —  사이트맵이 /en/db/person.html · /ja/db/person.html 같은 주소를
         126개 중 <b>76개</b> 적고 hreflang 도 그리로 가리키고 있었는데,
         저장소에 <b>en/ · ja/ 폴더가 없습니다.</b> 열어 보면 404 입니다
         (2026-08-19 확인 — Vercel NOT_FOUND).
         말 바꾸기는 assets/i18n.js 가 <b>화면 안에서</b> 글자만 바꾸는
         방식이라, 그런 주소는 애초에 생긴 적이 없습니다.

   무엇이 나빴나 — 사이트맵의 60%가 404 이면 구글이 사이트맵 자체를
         덜 믿습니다. 어긋난 hreflang 은 통째로 버려집니다.

   ★ 나중에 영어·일본어 판을 <b>정말로 만들면</b> 이 줄을
     ['en','ja'] 로 되돌리고 다시 돌리면 그대로 살아납니다.
     그 전에는 <b>비워 두십시오.</b> */
const LANGS = [];

/* ── 담을 화면 ──────────────────────────────────────────────────
   ★ 새 메뉴를 열면 여기에 한 줄만 보태고 이 파일을 다시 돌리십시오.
   ★ 상세 화면(-view.html)은 아직 넣지 않습니다 — 내용을 자바스크립트로
     불러오므로 봇에게는 빈 껍데기입니다. 미리 그려 주게 된 뒤에 엽니다. */
const PAGES = [
  ['/',                                    'daily',   '1.0'],
  /* ★ 2026-08-19 · `/home.html` 을 뺐습니다 — `/` 와 같은 화면입니다.
       둘 다 넣으면 구글이 중복으로 봅니다. home.html 의 canonical 이
       `/` 를 가리키므로 짧은 쪽 하나만 알립니다. */
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
lines.push('     ★ 지금은 한국어 판 하나뿐입니다. /en/ · /ja/ 판을 실제로 만들면');
lines.push('       scripts/build-sitemap.mjs 의 LANGS 를 다시 채우십시오.');
lines.push('       (없는 주소를 알리면 사이트맵을 통째로 덜 믿습니다).');
lines.push('');
lines.push('     ★ 이 파일은 목록·안내 화면만 담습니다.');
lines.push('       상세 화면은 sitemap-person.xml · sitemap-work.xml 에 있습니다. -->');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');

let count = 0;
for (const [path, freq, pri] of PAGES) {
  const langs = langsFor(path);
  for (const lang of langs) {
    lines.push('  <url>');
    lines.push(`    <loc>${href(lang, path)}</loc>`);
    /* 서로 가리키기 — 이 주소를 볼 수 있는 말 전부를 적습니다.
       ★ 2026-08-19 — <b>한국어 하나뿐이면 아예 적지 않습니다.</b>
         자기 혼자만 가리키는 hreflang 은 뜻이 없고, 없는 판을
         있는 것처럼 보이게 할 뿐입니다. */
    if (langs.length > 1) {
      for (const l of langs) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${href(l, path)}"/>`);
      }
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${href('ko', path)}"/>`);
    }
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push(`    <changefreq>${freq}</changefreq>`);
    lines.push(`    <priority>${pri}</priority>`);
    lines.push('  </url>');
    count++;
  }
}
lines.push('</urlset>');

put(join(ROOT, 'sitemap-pages.xml'), lines.join('\n') + '\n', 'sitemap-pages.xml');

/* ── 알림 ──────────────────────────────────────────────────────── */
const onlyKo = PAGES.filter(([p]) => langsFor(p).length === 1).length;
console.log(`  화면 ${PAGES.length}개 → 주소 ${count}개`);
if (LANGS.length === 0) {
  console.log('  한국어 판만 넣었습니다 (LANGS 가 비어 있습니다 — hreflang 없음)');
} else {
  console.log(`  영어·일본어에서 감춘 화면 ${onlyKo}개는 한국어만 넣었습니다`);
  for (const l of LANGS) {
    const n = PAGES.filter(([p]) => !hidden(l, p)).length;
    console.log(`    ${l} : ${n}개 (감춤 ${PAGES.length - n}개)`);
  }
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

/* ★★★ 2026-08-19 (파트너와 정함) · <b>상세 화면 열 갈래를 모두 알립니다</b>
   ══════════════════════════════════════════════════════════════
   여태 사이트맵에는 <b>인물·작품 둘</b>만 있었습니다. 그런데 봇에게 내용을
   그려 주는 `api/seo.js` 는 <b>열 갈래</b>를 다 그립니다 —
   공연장 · 음악단체 · 음악학교 · 학술 · 현대음악 · 기관재단 · 용어사전 ·
   그리고 <b>정보SPOT 4,629건.</b>

   ▶ 즉 <b>이미 만들어 둔 것을 구글에 안 알리고 있었습니다.</b>
     정보SPOT 은 오늘 6,002줄의 「이 글에 나온 것」이 붙은 곳입니다.
     내용이 가장 두꺼운데 사이트맵에 한 줄도 없었습니다.

   ★ 갈래 이름·주소는 `api/seo.js` 의 LISTS 와 <b>같아야 합니다.</b>
     여기 없는 갈래를 넣으면 구글이 404 를 받아 갑니다(사이트맵 전체를
     덜 믿습니다 — 8월에 /en/ 주소 76개로 겪었습니다).

   ★★ <b>lastmod 를 붙입니다.</b> 오늘 작품 928건의 한글 제목을 고쳤는데,
     lastmod 가 없으면 구글은 <b>바뀐 줄을 모릅니다.</b> 다시 와서 볼 이유가
     없습니다. updated_at 이 없는 표는 그냥 생략합니다(거짓 날짜보다 낫습니다). */
/* ★★★ `names` — <b>이름이 없는 줄은 사이트맵에 넣지 않습니다.</b>
   ══════════════════════════════════════════════════════════════
   `api/seo.js` 는 이름이 없으면 그립니다 —
       const nm = ... ; if (!nm) return null;   ← 404 가 됩니다
   즉 이름 빈 줄을 사이트맵에 적으면 <b>구글에 404 를 알리는 셈</b>입니다.
   이 파일 머리말에 이미 적혀 있습니다 — 8월에 /en/ 주소 76개가 404 여서
   「사이트맵의 60%가 404 면 구글이 사이트맵 자체를 덜 믿는다」고요.
   ▶ 그래서 <b>갈래마다 이름 칸을 적어 두고</b>, 하나라도 채워진 줄만 넣습니다.
   ★ 칸 이름이 갈래마다 다릅니다 — 작품은 title_ko/title,
     용어는 term_ko/term_en, 정보SPOT 은 title 뿐입니다.
     `api/seo.js` 의 nameOf 와 <b>같게</b> 맞췄습니다. */
const DETAIL = [
  { key:'person',     table:'persons',          view:'/db/person-view.html',     freq:'monthly', pri:'0.7', label:'인물',      names:['name_ko','name_en'] },
  { key:'work',       table:'person_works',     view:'/db/work-view.html',       freq:'monthly', pri:'0.6', label:'작품',      names:['title_ko','title'] },
  { key:'spot',       table:'spot',             view:'/spot/spot-view.html',     freq:'weekly',  pri:'0.8', label:'정보SPOT',  names:['title'] },
  { key:'venue',      table:'venues',           view:'/db/venue-view.html',      freq:'monthly', pri:'0.7', label:'공연장',    names:['name_ko','name_en'] },
  { key:'school',     table:'schools',          view:'/db/school-view.html',     freq:'monthly', pri:'0.7', label:'음악학교',  names:['name_ko','name_en'] },
  { key:'org',        table:'orgs',             view:'/db/org-view.html',        freq:'monthly', pri:'0.7', label:'음악단체',  names:['name_ko','name_en'] },
  { key:'foundation', table:'foundations',      view:'/db/foundation-view.html', freq:'monthly', pri:'0.6', label:'기관·재단', names:['name_ko','name_en'] },
  { key:'modern',     table:'modern_composers', view:'/db/modern-view.html',     freq:'monthly', pri:'0.6', label:'현대음악',  names:['name_ko','name_en'] },
  { key:'academic',   table:'academic',         view:'/db/academic-view.html',   freq:'monthly', pri:'0.6', label:'학술',      names:['name_ko','name_en'] },
  { key:'terms',      table:'oc_terms',         view:'/db/terms-view.html',      freq:'monthly', pri:'0.6', label:'음악용어',  names:['term_ko','term_en'] },
];

/* ★★ 표마다 <b>있는 칸이 다릅니다.</b> `updated_at` 도 `hidden` 도 없는 표가
     있습니다. 없는 칸을 적으면 PostgREST 가 <b>400(42703)</b> 을 주고
     사이트맵 만들기가 통째로 멈춥니다.
   ▶ 그래서 <b>넉넉한 쪽부터 시도하고, 안 되면 한 단씩 뺍니다.</b>
     (훑개에서 쓰던 방법과 같습니다 — 짐작하지 않고 물어봅니다.) */
async function getRows(d) {
  const nm = (d.names || []).join(',');
  const tries = [
    { sel: `id,updated_at${nm ? ',' + nm : ''}`, extra: '&hidden=not.is.true', mod: true,  names: !!nm },
    { sel: `id,updated_at${nm ? ',' + nm : ''}`, extra: '',                    mod: true,  names: !!nm },
    { sel: `id${nm ? ',' + nm : ''}`,            extra: '&hidden=not.is.true', mod: false, names: !!nm },
    { sel: `id${nm ? ',' + nm : ''}`,            extra: '',                    mod: false, names: !!nm },
    /* ★ 이름 칸 이름을 제가 틀리게 적었을 수도 있습니다. 그때는 <b>거르지 않고</b>
         전부 넣습니다 — 거르려다 통째로 못 만드는 것보다 낫습니다.
         대신 화면에 「이름 칸을 못 읽었습니다」라고 크게 알립니다. */
    { sel: 'id,updated_at',                      extra: '&hidden=not.is.true', mod: true,  names: false },
    { sel: 'id',                                 extra: '&hidden=not.is.true', mod: false, names: false },
    { sel: 'id',                                 extra: '',                    mod: false, names: false },
  ];
  let last = null;
  for (const t of tries) {
    try {
      const rows = await getAll(`${d.table}?select=${t.sel}${t.extra}&order=id`, d.label);
      /* ★★★ 2026-08-19 · <b>어느 칸을 읽었는지 반드시 찍습니다.</b>
         ─────────────────────────────────────────────────────────
         이름 거르기를 넣고 돌렸더니 <b>결과가 이전과 한 글자도 같았습니다.</b>
         그럴 수 있는 경우가 둘인데 <b>로그로 구별이 안 됐습니다</b> —
           ⓐ 새 파일이 아직 안 올라가서 옛 코드가 돌았다
           ⓑ 새 코드가 돌았고 이름 빈 줄이 <b>정말 하나도 없다</b>
         「문제가 있을 때만 찍는」 로그는 <b>아무 일도 없었는지, 아니면
         코드가 안 돌았는지</b>를 말해 주지 못합니다.
         ▶ 그래서 <b>언제나</b> 무엇을 읽었는지 한 줄 찍습니다. */
      return { rows, lastmod: t.mod, named: t.names, sel: t.sel + t.extra };
    } catch (e) { last = e; }
  }
  throw last;
}

/* 날짜만 남깁니다 — 2026-08-19T03:43:09Z → 2026-08-19 */
function ymd(v) {
  const s = String(v || '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

/* 상세 화면 묶음 — hreflang 도 lastmod 도 없이 단순하게 */
function plainSet(items, freq, pri, note) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<!-- ${note}\n     ★ scripts/build-sitemap.mjs 가 만듭니다. 손으로 고치지 마십시오. -->\n`
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + items.map(it => {
        const u = typeof it === 'string' ? it : it.loc;
        const m = typeof it === 'string' ? '' : (it.lastmod || '');
        return `  <url><loc>${u}</loc>`
          + (m ? `<lastmod>${m}</lastmod>` : '')
          + `<changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;
      }).join('\n')
    + '\n</urlset>\n';
}

const parts = ['sitemap-pages.xml'];

if (!SB_URL || !SB_KEY) {
  console.log('');
  console.log('  ※ SUPABASE 키가 없어 상세 화면은 건너뜁니다 (목록만 다시 만들었습니다).');
  /* ★ 있던 상세 사이트맵을 <b>지우지 않습니다.</b> 목차에도 그대로
       남겨 두어야 이미 색인된 것을 잃지 않습니다. */
  for (const d of DETAIL) {
    const f = `sitemap-${d.key}.xml`;
    try { readFileSync(join(ROOT, f), 'utf8'); parts.push(f); } catch (e) { /* 없으면 뺍니다 */ }
  }
} else {
  console.log('');
  let total = 0;
  for (const d of DETAIL) {
    let got;
    try {
      got = await getRows(d);
    } catch (e) {
      /* ★ 한 갈래가 안 되면 <b>그 갈래만</b> 건너뜁니다. 통째로 멈추면
           멀쩡한 아홉 갈래도 못 만듭니다. 다만 <b>크게 알립니다.</b> */
      console.log(`  ✗ ${d.label} 건너뜀 — ${String(e.message).slice(0, 110)}`);
      const f = `sitemap-${d.key}.xml`;
      try { readFileSync(join(ROOT, f), 'utf8'); parts.push(f); } catch (e2) {}
      continue;
    }
    /* 이름이 하나라도 채워진 줄만 — 없으면 api/seo.js 가 404 를 줍니다 */
    const keep = got.named
      ? got.rows.filter(r => (d.names || []).some(
          k => String(r[k] == null ? '' : r[k]).trim() !== ''))
      : got.rows;
    const dropped = got.rows.length - keep.length;
    const items = keep.map(r => ({
      loc: `${ORIGIN}${d.view}?id=${r.id}`,
      lastmod: got.lastmod ? ymd(r.updated_at) : '',
    }));
    const withMod = items.filter(x => x.lastmod).length;
    put(join(ROOT, `sitemap-${d.key}.xml`), plainSet(
      items, d.freq, d.pri, `OPUSCLAM.COM ${d.label} 상세`), `sitemap-${d.key}.xml`);
    parts.push(`sitemap-${d.key}.xml`);
    total += items.length;
    console.log(`    ↳ 읽은 칸 : ${got.sel}`
      + (got.named ? ` · 이름 거르기 켜짐(${(d.names || []).join('/')})` : ' · 이름 거르기 꺼짐'));
    console.log(`  · ${d.label} ${items.length}건`
      + (withMod ? ` (바뀐 날 ${withMod}건)` : ' (바뀐 날 없음 — updated_at 칸이 없습니다)')
      + (dropped ? ` · ★ 이름이 없어 뺀 것 ${dropped}건` : '')
      + (got.named ? '' : ' · ★ 이름 칸을 못 읽어 거르지 않았습니다'));
  }
  console.log(`  ─ 상세 화면 합계 ${total}건`);
}

/* ── 목차 ────────────────────────────────────────────────────────
   ★ 서치 콘솔에는 이 파일 하나만 제출하면 됩니다. */
put(join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<!-- OPUSCLAM.COM 사이트맵 목차\n'
  + '     ★ scripts/build-sitemap.mjs 가 만듭니다. 손으로 고치지 마십시오.\n'
  + '     ★ 서치 콘솔에는 이 파일 하나만 제출하면 됩니다. -->\n'
  + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + parts.map(f => `  <sitemap><loc>${ORIGIN}/${f}</loc></sitemap>`).join('\n')
  + '\n</sitemapindex>\n', 'sitemap.xml');

console.log('');
console.log(SAVE
  ? '▶ 만든 파일 : ' + ['sitemap.xml'].concat(parts).join(' · ')
  : '▶ 세기만 했습니다 — 아무 파일도 쓰지 않았습니다.'
    + ' 실제로 만들려면 `--save` 를 붙이십시오'
    + ' (워크플로에서는 「실제로 만들어 올리기 = yes」).');
