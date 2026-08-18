/* ============================================================
   봇에게 상세 화면을 <b>미리 그려 줍니다</b>
   api/seo.js                                     2026-08-19
   ------------------------------------------------------------
   ★ 무엇이 문제였나
     인물 15,511명 · 작품 17,061건 상세 화면이 <b>검색에 안 나옵니다.</b>
     세 겹으로 막혀 있었습니다 —
       ① robots.txt 의  Disallow: /*-view.html
       ② 화면 안의     <meta name="robots" content="noindex">
       ③ 자바스크립트로 자료를 받아 <b>봇에게는 빈 껍데기</b>
     ③이 진짜 문제입니다. ①②를 풀어도 구글이 볼 것이 없습니다.

   ★ 어떻게 푸나 — <b>봇에게만</b> 서버가 미리 그려 줍니다
       사람 → 지금처럼 자바스크립트 (화면을 하나도 손대지 않습니다)
       봇   → 이 함수가 Supabase 에서 읽어 <b>온전한 HTML</b>을 돌려줍니다
     vercel.json 의 rewrite 가 봇만 이리로 보냅니다.

   ★ 왜 화면을 손대지 않나 — 상세 화면은 오래 다듬어 온 것입니다.
     서버 렌더링을 넣으려고 뜯어고치면 <b>사람이 보는 화면이 깨질</b>
     위험이 있습니다. 봇만 갈라내면 실패해도 사람 쪽은 그대로 돕니다.

   ★★ 이 함수가 그려 주는 HTML 은 <b>사람용이 아닙니다.</b>
     구글이 읽을 제목·소개문·자료만 담습니다. 사람이 이 주소로 오면
     원래 화면으로 보냅니다(canonical + 새로 고침).

   ★ 저작권 — 위키백과에서 온 소개문은 CC BY-SA 이므로
     <b>출처를 함께 적습니다.</b> legal/data-policy.html 에 세워 둔
     정책과 같습니다.
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL || 'https://ptdxzxkgddvkusamkiol.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY
            || 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

const SITE = 'https://opusclam.com';

/* ── 글자 지키기 ──────────────────────────────────────────
   ★ 자료에 든 <>&" 가 HTML 을 깨뜨리지 않게 바꿉니다.
     이름에 「&」가 든 단체가 있습니다 (Nationale Opera & Ballet). */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 소개문에서 태그를 떼고 한 줄로 — meta description 에 씁니다 */
function plain(v, max) {
  const s = String(v == null ? '' : v)
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!max || s.length <= max) return s;
  /* 낱말 가운데서 끊지 않습니다 */
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

/* ── 생몰 표기 ────────────────────────────────────────────
   ★ 「1685~1750」 · 「1985~」 · 「~1750」 세 꼴을 다룹니다. */
function life(p) {
  const b = p.birth_year, d = p.death_year;
  if (b && d) return `${b}~${d}`;
  if (b) return `${b}~`;
  if (d) return `~${d}`;
  return '';
}

/* ── 인물 ─────────────────────────────────────────────── */
async function person(id) {
  const rows = await sb(`persons?select=id,name_ko,name_en,field,instrument,nationality,`
    + `birth_year,death_year,era_name,school,description,description_en,image_url,hidden`
    + `&id=eq.${encodeURIComponent(id)}&limit=1`);
  const p = rows && rows[0];
  if (!p) return null;
  /* ★ 숨긴 인물은 <b>색인하지 않습니다</b> — 자료가 모자라 감춘 사람입니다 */
  if (p.hidden === true) return { skip: true };

  const nm = p.name_ko || p.name_en || '';
  const en = (p.name_en && p.name_en !== p.name_ko) ? p.name_en : '';
  const lf = life(p);

  /* 작품·수상은 곁들이입니다. 없어도 됩니다. */
  let works = [];
  try {
    works = await sb(`person_works?select=id,title,title_ko,form_ko,year_from`
      + `&person_id=eq.${encodeURIComponent(id)}&order=year_from.asc.nullslast&limit=40`);
  } catch (e) { /* 없으면 그대로 */ }

  const facts = [
    ['분야', p.field], ['악기', p.instrument], ['국적', p.nationality],
    ['생몰', lf], ['시대', p.era_name], ['출신학교', p.school],
  ].filter(([, v]) => v);

  const desc = p.description || p.description_en || '';
  const head = [nm, en, lf].filter(Boolean).join(' · ');

  return {
    title: `${head} · 인물DB · OPUSCLAM`,
    desc: plain(desc, 155) || `${head} — 클래식 음악 인물 정보`,
    image: p.image_url || '',
    canonical: `${SITE}/db/person-view.html?id=${encodeURIComponent(id)}`,
    body:
      `<h1>${esc(nm)}</h1>`
      + (en ? `<p class="en">${esc(en)}</p>` : '')
      + (lf ? `<p class="life">${esc(lf)}</p>` : '')
      + (facts.length
          ? '<dl>' + facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>'
          : '')
      + (desc
          ? `<section><h2>소개</h2><p>${esc(plain(desc, 4000))}</p>`
            + '<p class="src">출처: 위키백과 · CC BY-SA</p></section>'
          : '')
      + (works.length
          ? '<section><h2>작품 ' + works.length + '건</h2><ul>'
            + works.map(w => `<li>${esc(w.title_ko || w.title || '')}`
                + (w.form_ko ? ` <span>${esc(w.form_ko)}</span>` : '')
                + (w.year_from ? ` <span>${esc(w.year_from)}</span>` : '')
                + `</li>`).join('')
            + '</ul></section>'
          : ''),
  };
}

/* ── 작품 ─────────────────────────────────────────────── */
async function work(id) {
  const rows = await sb(`person_works?select=id,title,title_ko,form_ko,genre,`
    + `year_from,year_text,opus,key_name,note,imslp_ref,`
    + `persons(id,name_ko,name_en,era_name)`
    + `&id=eq.${encodeURIComponent(id)}&limit=1`);
  const w = rows && rows[0];
  if (!w) return null;

  const ti = w.title_ko || w.title || '';
  const en = (w.title && w.title !== w.title_ko) ? w.title : '';
  const cp = w.persons || {};
  const cn = cp.name_ko || cp.name_en || '';

  const facts = [
    ['작곡가', cn], ['형식', w.form_ko], ['편성', w.genre],
    ['작곡 연도', w.year_from || w.year_text], ['작품 번호', w.opus],
    ['조성', w.key_name], ['시대', cp.era_name],
  ].filter(([, v]) => v);

  const head = [ti, cn].filter(Boolean).join(' · ');

  return {
    title: `${head} · 작품DB · OPUSCLAM`,
    desc: plain(w.note, 155)
      || `${ti}${cn ? ' — ' + cn : ''}${w.form_ko ? ' · ' + w.form_ko : ''} 클래식 작품 정보`,
    image: '',
    canonical: `${SITE}/db/work-view.html?id=${encodeURIComponent(id)}`,
    body:
      `<h1>${esc(ti)}</h1>`
      + (en ? `<p class="en">${esc(en)}</p>` : '')
      + (cn ? `<p class="by">${esc(cn)}</p>` : '')
      + (facts.length
          ? '<dl>' + facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>'
          : '')
      + (w.note ? `<section><h2>설명</h2><p>${esc(plain(w.note, 4000))}</p></section>` : ''),
  };
}

/* ── 껍데기 ───────────────────────────────────────────────
   ★ 사람이 이 주소로 오면 <b>원래 화면으로 보냅니다.</b>
     봇은 자바스크립트를 안 돌리므로 HTML 만 읽고 갑니다. */
function page(d) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.desc)}">
<link rel="canonical" href="${esc(d.canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(d.title)}">
<meta property="og:description" content="${esc(d.desc)}">
<meta property="og:url" content="${esc(d.canonical)}">
${d.image ? `<meta property="og:image" content="${esc(d.image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:760px;
  margin:0 auto;padding:28px 20px;line-height:1.7;color:#222}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:26px 0 8px}
.en,.by,.life{color:#666;margin:2px 0}
dl{display:grid;grid-template-columns:110px 1fr;gap:6px 14px;margin:18px 0}
dt{color:#777}dd{margin:0}
ul{padding-left:18px}li{margin:3px 0}li span{color:#888;font-size:13px}
.src{color:#999;font-size:12px}
</style>
</head>
<body>
${d.body}
<p><a href="${esc(d.canonical)}">OPUSCLAM 에서 자세히 보기</a></p>
<script>location.replace(${JSON.stringify(d.canonical)});</script>
</body>
</html>`;
}

/* ── 들어오는 곳 ─────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'opusclam.com'}`);
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');

    /* ★ 번호가 없거나 숫자가 아니면 <b>색인하지 않습니다</b> —
         목록으로 보내면 같은 내용이 여러 주소로 잡힙니다. */
    if (!id || !/^\d+$/.test(id)) {
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send('not found');
      return;
    }

    let d = null;
    if (kind === 'person') d = await person(id);
    else if (kind === 'work') d = await work(id);

    /* 없는 번호 · 숨긴 인물 → 404 로 알립니다.
       ★ 200 으로 빈 화면을 주면 구글이 <b>빈 페이지를 색인</b>합니다. */
    if (!d || d.skip) {
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send('not found');
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    /* ★ 하루 담아 두고, 지난 것도 이레까지 쓰게 합니다.
         봇이 자주 와도 Supabase 를 매번 두드리지 않습니다. */
    res.setHeader('Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(page(d));
  } catch (e) {
    /* ★ 실패하면 <b>500 을 줍니다.</b> 빈 화면을 200 으로 주면
         구글이 그것을 색인해 버립니다. 500 이면 나중에 다시 옵니다. */
    res.setHeader('X-Robots-Tag', 'noindex');
    res.status(500).send('error');
  }
}
