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
  /* ★★ 2026-08-19 — <b>까닭까지 들고 던집니다.</b>
       예전에는 「Supabase 400」 이라고만 해서, 화면에는 `error` 넉 자만
       나오고 <b>어느 칸이 어긋났는지 알 길이 없었습니다.</b>
       (실제로 `key_name` 이라는 없는 칸 하나 때문에 작품 화면이 모두
        무너져 있었는데, 찾는 데 애를 먹었습니다.) */
  if (!r.ok) {
    let why = '';
    try { why = (await r.text()).slice(0, 300); } catch (e) { /* 못 읽으면 그냥 */ }
    throw new Error(`Supabase ${r.status} · ${why}`);
  }
  return r.json();
}

/* ★★ 2026-08-19 · 몇 건인지도 함께 받습니다 (목록 화면에 씁니다)
     PostgREST 는 Prefer: count=exact 를 주면 Content-Range 머리글에
     「0-199/15509」 처럼 <b>전체 건수</b>를 적어 보냅니다. */
/* ★★ 2026-08-19 · <b>칸 이름이 틀려도 화면이 죽지 않게</b>
     `key_name` 하나로 작품 17,061건이 모두 500 이었던 일을 겪었습니다.
     갈래를 넓힐 때마다 그 위험이 늘어나므로, 골라 받기가 거절당하면
     <b>`select=*` 로 한 번 더</b> 물어봅니다. 조금 무겁지만 살아납니다. */
async function sbCountSafe(table, select, rest) {
  try {
    return await sbCount(`${table}?select=${select}${rest}`);
  } catch (e) {
    if (!/Supabase 4\d\d/.test(String(e && e.message))) throw e;
    return sbCount(`${table}?select=*${rest}`);
  }
}

async function sbCount(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'count=exact' },
  });
  if (!r.ok) {
    let why = '';
    try { why = (await r.text()).slice(0, 300); } catch (e) { /* 못 읽으면 그냥 */ }
    throw new Error(`Supabase ${r.status} · ${why}`);
  }
  let total = 0;
  const cr = r.headers.get('content-range');
  if (cr) {
    const q = cr.split('/')[1];
    if (q && q !== '*') total = parseInt(q, 10) || 0;
  }
  return { rows: await r.json(), total };
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
  /* ★★ 2026-08-19 고침 — <b>이미 큰 제목에 쓴 것과 견줍니다.</b>
       예전에는 name_ko 와 견주었습니다. 그래서 한글 이름이 비어 있으면
       큰 제목에 영문이 올라가고 그 아래 <b>같은 영문이 또</b> 찍혔습니다. */
  const en = (p.name_en && p.name_en !== nm) ? p.name_en : '';
  const lf = life(p);

  /* 작품·수상은 곁들이입니다. 없어도 됩니다. */
  let works = [];
  try {
    works = await sb(`person_works?select=id,title,title_ko,form_ko,year_from`
      + `&person_id=eq.${encodeURIComponent(id)}&hidden=is.false`
      + `&order=year_from.asc.nullslast&limit=40`);
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
      /* ★★ 2026-08-19 — 작품 이름에 <b>링크를 답니다.</b>
           구글이 인물 화면을 타고 작품 화면까지 걸어 들어갈 길이 됩니다.
           사이트맵만으로도 가긴 하지만, 서로 이어진 것이 훨씬 낫습니다. */
      /* ★ 2026-08-19 · 목록으로 돌아가는 길 — 구글이 오갈 수 있게 */
      + `<p><a href="${SITE}/db/person.html">인물DB 목록</a></p>`
      + (works.length
          ? '<section><h2>작품 ' + works.length + '건</h2><ul>'
            + works.map(w => `<li><a href="${SITE}/db/work-view.html?id=${encodeURIComponent(w.id)}">`
                + `${esc(w.title_ko || w.title || '')}</a>`
                + (w.form_ko ? ` <span>${esc(w.form_ko)}</span>` : '')
                + (w.year_from ? ` <span>${esc(w.year_from)}</span>` : '')
                + `</li>`).join('')
            + '</ul></section>'
          : ''),
  };
}

/* ── 작품 ─────────────────────────────────────────────── */
/* ★★ 2026-08-19 고침 — <b>실제 칸 이름에 맞췄습니다.</b>

   무엇이 잘못이었나
     · `key_name`(조성) 이라는 칸은 <b>person_works 에 없습니다.</b>
       PostgREST 가 물음 전체를 거절해(42703) 작품 화면이 모두
       500 이었습니다. 한 칸이 어긋나면 <b>다 무너집니다.</b>
     · 작곡가를 `persons(...)` 로 곁들여 오고 있었는데, 그럴 까닭이
       없습니다. <b>composer_ko · composer_en 이 같은 줄에 있습니다.</b>
       이어 붙이기를 그만두면 어긋날 여지도 사라집니다.

   실제로 있는 칸 (2026-08-19 확인)
     id · person_id · title · title_ko · subtitle · opus ·
     year_text · year_from · year_to · genre · instrumentation ·
     note · era · form_raw · form_ko · form_qid ·
     composer_ko · composer_en · imslp_ref · wikidata_id ·
     name_ja · hidden · hidden_note · is_popular · is_recommended ·
     source · source_id · created_at · updated_at

   ★ 칸 이름을 짐작하지 마십시오. 위 주소로 `select=*` 를 한 번
     열어 보면 그대로 나옵니다. */
async function work(id) {
  const rows = await sb(`person_works?select=id,person_id,title,title_ko,subtitle,`
    + `form_ko,genre,instrumentation,year_from,year_to,year_text,opus,era,`
    + `note,imslp_ref,composer_ko,composer_en,hidden`
    + `&id=eq.${encodeURIComponent(id)}&limit=1`);
  const w = rows && rows[0];
  if (!w) return null;
  /* ★ 숨긴 작품은 <b>색인하지 않습니다</b> — 인물과 같은 기준입니다 */
  if (w.hidden === true) return { skip: true };

  const ti = w.title_ko || w.title || '';
  /* ★ 인물과 같은 고침 — 한글 제목이 없으면 원제가 큰 제목으로 올라가므로,
       그때는 「원제」 줄을 따로 두지 않습니다. */
  const en = (w.title && w.title !== ti) ? w.title : '';
  const sub = (w.subtitle && w.subtitle !== ti && w.subtitle !== en) ? w.subtitle : '';
  const cn = w.composer_ko || w.composer_en || '';

  /* 작곡 연도 — 「1717~1723」 · 「1717」 · 글로 적힌 것 차례로 */
  const yr = (w.year_from && w.year_to && w.year_from !== w.year_to)
    ? `${w.year_from}~${w.year_to}`
    : (w.year_from || w.year_text || '');

  const facts = [
    ['작곡가', cn], ['형식', w.form_ko],
    ['편성', w.genre], ['악기', w.instrumentation],
    ['작곡 연도', yr], ['작품 번호', w.opus],
    ['시대', w.era], ['IMSLP', w.imslp_ref],
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
      + (sub ? `<p class="en">${esc(sub)}</p>` : '')
      /* ★ 작곡가 이름에 <b>인물 화면 링크</b>를 답니다 — 작품과 인물이
           서로 이어져 구글이 오갈 수 있습니다. */
      + (cn
          ? (w.person_id
              ? `<p class="by"><a href="${SITE}/db/person-view.html?id=${encodeURIComponent(w.person_id)}">${esc(cn)}</a></p>`
              : `<p class="by">${esc(cn)}</p>`)
          : '')
      + (facts.length
          ? '<dl>' + facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>'
          : '')
      /* ★ 2026-08-19 · 목록으로 돌아가는 길 */
      + `<p><a href="${SITE}/db/work.html">작품DB 목록</a></p>`
      + (w.note ? `<section><h2>설명</h2><p>${esc(plain(w.note, 4000))}</p></section>` : ''),
  };
}

/* ============================================================
   목록 화면 — <b>봇이 걸어 들어갈 길</b>            2026-08-19
   ------------------------------------------------------------
   ★ 왜 필요한가
     서치 콘솔이 인물 상세에 대해 이렇게 말했습니다 —
         참조 페이지 : <b>감지된 페이지 없음</b>
     즉 그 화면으로 <b>걸어 들어갈 링크가 하나도 없습니다.</b> 메뉴는
     include.js 가 나중에 그려 넣고 목록도 자바스크립트라, 봇 눈에는
     링크가 보이지 않습니다. 사이트맵으로 주소는 알렸지만, 구글은
     <b>링크가 없는 주소를 뒤로 미룹니다</b> — 그래서 인물 15,509명이
     「발견됨 · 현재 색인이 생성되지 않음」에 머물러 있습니다.

   ★ 어떤 주소를 쓰나 — <b>`?p=3` 은 사람 목록도 이미 알아듣습니다</b>
     (assets/db-list.js). 그러니 봇만을 위한 새 주소를 만들지 않습니다.
     사람이 그 주소로 와도 목록이 정상으로 열립니다.

   ★ 한 쪽에 200개, 그리고 <b>모든 쪽으로 가는 링크</b>를 함께 답니다.
       인물 15,509명 → 78쪽 · 작품 17,061건 → 86쪽
     그래서 사이트맵에 이미 든 `/db/person.html` 한 곳만 구글이 들어오면
     거기서 78쪽 전부가 보이고, 각 쪽에서 200명씩 상세로 이어집니다.
     ▶ <b>사이트맵을 늘릴 필요가 없습니다.</b>

   ★ 차례는 <b>id</b>로 고정합니다. 사람 화면의 기본 차례(quality 등)는
     같은 값이 많아 쪽을 넘길 때 <b>빠지거나 겹치는 것이 생깁니다.</b>
     빠지면 그 사람은 어느 쪽에도 안 나와 영영 링크가 없습니다.
   ============================================================ */
const PER = 200;

/* ★★ 2026-08-19 · 여섯 갈래를 더 엽니다 (공연장·단체·학교·학술·현대음악·기관)
     ★ 칸 이름은 <b>사람 목록이 실제로 쓰는 것</b>만 씁니다
       (각 화면의 searchCols · db-list.js 의 hidden 거르기에서 확인).
       그래도 틀릴 수 있으니 위 sbCountSafe 가 받쳐 줍니다. */
const LISTS = {
  person: {
    table: 'persons',
    select: 'id,name_ko,name_en,birth_year,death_year',
    filter: '&hidden=not.is.true',
    list: '/db/person.html', view: '/db/person-view.html',
    name: '인물DB', unit: '명',
    row: (r) => {
      const nm = r.name_ko || r.name_en || '';
      const lf = life(r);
      return { text: nm, sub: [(r.name_ko && r.name_en && r.name_en !== r.name_ko) ? r.name_en : '', lf] };
    },
  },
  work: {
    table: 'person_works',
    select: 'id,title,title_ko,composer_ko,composer_en,form_ko',
    filter: '&hidden=not.is.true',
    list: '/db/work.html', view: '/db/work-view.html',
    name: '작품DB', unit: '건',
    row: (r) => ({
      text: r.title_ko || r.title || '',
      sub: [r.composer_ko || r.composer_en || '', r.form_ko || ''],
    }),
  },
  venue: {
    table: 'venues', select: 'id,name_ko,name_en,location,operator',
    list: '/db/venue.html', view: '/db/venue-view.html', name: '공연장DB', unit: '곳',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.name_ko && r.name_en, r.location] }),
  },
  org: {
    table: 'orgs', select: 'id,name_ko,name_en,location,leader',
    list: '/db/org.html', view: '/db/org-view.html', name: '음악단체DB', unit: '곳',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.name_ko && r.name_en, r.location] }),
  },
  school: {
    table: 'schools', select: 'id,name_ko,name_en,location',
    list: '/db/school.html', view: '/db/school-view.html', name: '음악학교DB', unit: '곳',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.name_ko && r.name_en, r.location] }),
  },
  academic: {
    table: 'academic', select: 'id,name_ko,name_en,author,field',
    list: '/db/academic.html', view: '/db/academic-view.html', name: '학술DB', unit: '건',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.author, r.field] }),
  },
  modern: {
    table: 'modern_composers', select: 'id,name_ko,name_en',
    list: '/db/modern.html', view: '/db/modern-view.html', name: '현대음악DB', unit: '명',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.name_ko && r.name_en] }),
  },
  foundation: {
    table: 'foundations', select: 'id,name_ko,name_en,location,field',
    list: '/db/foundation.html', view: '/db/foundation-view.html', name: '기관·재단DB', unit: '곳',
    row: (r) => ({ text: r.name_ko || r.name_en || '', sub: [r.location, r.field] }),
  },
  /* ★★ 2026-08-19 · 이름 칸이 <b>다른</b> 갈래 둘
       용어사전은 `term_ko`, 정보SPOT 은 `title` 입니다. 그래서 상세를
       그릴 때 쓸 이름 고르개(`nameOf`)를 따로 적어 둡니다. */
  terms: {
    table: 'oc_terms', select: 'id,term_ko,term_en,reading,work_form',
    list: '/db/terms.html', view: '/db/terms-view.html', name: '음악용어사전', unit: '개',
    nameOf: (r) => r.term_ko || r.term_en || '',
    row: (r) => ({ text: r.term_ko || r.term_en || '',
                   sub: [r.term_ko && r.term_en, r.work_form] }),
  },
  /* 정보SPOT — 표 하나(spot)를 여섯 갈래(section)가 나눠 씁니다.
     ★ 목록은 <b>갈래를 가리지 않고 모두</b> 담습니다. 사람 화면은
       갈래별로 나뉘어 있지만, 봇에게 필요한 것은 「모든 상세로 가는
       길」이므로 한 줄기로 두는 편이 짧고 빠짐이 없습니다. */
  spot: {
    table: 'spot', select: 'id,section,category,title,venue_name,date_from',
    list: '/spot/index.html', view: '/spot/spot-view.html', name: '정보SPOT', unit: '건',
    nameOf: (r) => r.title || '',
    row: (r) => ({ text: r.title || '',
                   sub: [r.section, r.venue_name || String(r.date_from || '').slice(0, 10)] }),
  },
};

/* 모든 갈래가 <b>서로를 가리킵니다</b> — 구글이 어느 하나로 들어와도
   나머지 일곱으로 퍼집니다. */
function siblings(cur) {
  return Object.keys(LISTS)
    .filter(k => k !== cur)
    .map(k => `<a href="${SITE}${LISTS[k].list}">${esc(LISTS[k].name)}</a>`)
    .join(' · ');
}

/* 쪽 주소 — 첫 쪽은 물음표 없이 (같은 화면이 두 주소로 잡히지 않게) */
function pageHref(c, n) {
  return SITE + c.list + (n > 1 ? '?p=' + n : '');
}

/* 쪽 고르개 — <b>모든 쪽</b>을 답니다. 78~86개라 한 화면에 들어갑니다.
   ★ 몇 개만 걸고 「다음」으로 이으면 구글이 마지막 쪽까지 가는 데
     78번을 거쳐야 합니다. 다 걸면 <b>어느 쪽이든 두 걸음</b>입니다. */
function pager(c, cur, pages) {
  if (pages < 2) return '';
  let out = '<nav class="pg"><h2>쪽</h2>';
  if (cur > 1) out += `<a rel="prev" href="${pageHref(c, cur - 1)}">이전</a> `;
  for (let n = 1; n <= pages; n++) {
    out += (n === cur)
      ? `<b>${n}</b> `
      : `<a href="${pageHref(c, n)}">${n}</a> `;
  }
  if (cur < pages) out += `<a rel="next" href="${pageHref(c, cur + 1)}">다음</a>`;
  return out + '</nav>';
}

async function list(kind, page) {
  const c = LISTS[kind];
  if (!c) return null;
  const off = (page - 1) * PER;
  /* 갈래마다 따로 적지 않으면 <b>숨긴 것만</b> 뺍니다 */
  const filt = c.filter || '&hidden=not.is.true';
  const { rows, total } = await sbCountSafe(
    c.table, c.select, `${filt}&order=id.asc&limit=${PER}&offset=${off}`);
  if (!rows || !rows.length) return null;          /* 없는 쪽 → 404 */

  const pages = Math.max(1, Math.ceil(total / PER));
  const from = off + 1, to = off + rows.length;
  const head = c.name + (page > 1 ? ` · ${page}쪽` : '');

  return {
    title: `${head} · OPUSCLAM`,
    desc: `클래식 ${c.name} ${total.toLocaleString('en-US')}${c.unit}`
        + ` — ${from.toLocaleString('en-US')}~${to.toLocaleString('en-US')}번째`,
    image: '',
    canonical: pageHref(c, page),
    body:
      `<h1>${esc(head)}</h1>`
      + `<p class="life">모두 ${esc(total.toLocaleString('en-US'))}${esc(c.unit)}`
      + ` · ${esc(String(page))}/${esc(String(pages))}쪽</p>`
      + '<ul>'
      + rows.map(r => {
          const it = c.row(r);
          const sub = it.sub.filter(Boolean).map(s => ` <span>${esc(s)}</span>`).join('');
          return `<li><a href="${SITE}${c.view}?id=${encodeURIComponent(r.id)}">`
               + `${esc(it.text)}</a>${sub}</li>`;
        }).join('')
      + '</ul>'
      + pager(c, page, pages)
      /* 다른 갈래·대문으로도 이어 둡니다 — 링크가 한 방향뿐이면
         구글이 오갈 길이 좁습니다 */
      + `<p>${siblings(kind)} · <a href="${SITE}/">OPUSCLAM</a></p>`,
  };
}

/* ============================================================
   여섯 갈래 상세 — 공연장·단체·학교·학술·현대음악·기관 · 2026-08-19
   ------------------------------------------------------------
   ★ 인물·작품과 달리 <b>칸을 골라 받지 않고 `select=*` 로 받습니다.</b>
     갈래마다 칸이 조금씩 다른데, 하나라도 틀리면 PostgREST 가
     물음 전체를 거절합니다(`key_name` 으로 겪었습니다). `*` 는
     절대 거절당하지 않습니다.
   ★ 대신 <b>아는 칸만 골라 보여 줍니다.</b> 아래 표에 없는 칸은
     화면에 나오지 않으므로, 자료에 내부용 칸이 있어도 새지 않습니다.
   ============================================================ */
const FIELD_LABEL = {
  name_en: '영문명', location: '위치', address: '주소', region: '지역',
  operator: '운영', leader: '대표', founded: '설립', founded_year: '설립',
  opened_year: '개관', capacity: '객석', seats: '객석',
  type: '유형', category: '갈래', field: '분야', instrument: '악기',
  departments: '학과', alumni: '동문',
  author: '저자', publisher: '발행처', affil: '소속', keywords: '주제어',
  year: '연도', business: '사업', technique: '기법', works: '주요 작품',
  nationality: '국적', era_name: '시대', school: '출신학교',
  homepage: '누리집', website: '누리집',
  /* ★ 2026-08-19 · 용어사전·정보SPOT 이 쓰는 칸 */
  term_en: '영문', reading: '읽기', work_form: '형식',
  section: '갈래', venue_name: '공연장',
  date_from: '시작', date_to: '끝', city: '도시', country: '나라',
};

/* 아는 칸만, 값이 있는 것만, 너무 긴 것은 잘라서 */
function facts(r) {
  const out = [];
  for (const k in FIELD_LABEL) {
    const v = r[k];
    if (v == null || v === '' || typeof v === 'object') continue;
    out.push([FIELD_LABEL[k], plain(v, 200)]);
  }
  return out;
}

async function entity(kind, id) {
  const c = LISTS[kind];
  if (!c) return null;
  const rows = await sb(`${c.table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const r = rows && rows[0];
  if (!r) return null;
  if (r.hidden === true) return { skip: true };

  const nm = (c.nameOf ? c.nameOf(r) : (r.name_ko || r.name_en)) || '';
  if (!nm) return null;                       /* 이름이 없으면 색인할 값이 없습니다 */
  /* 갈래마다 소개문 칸 이름이 다릅니다 — 용어사전은 summary·body,
     정보SPOT 은 body 입니다. 있는 것을 차례로 씁니다. */
  const desc = r.description || r.description_en || r.note
            || r.summary || r.body || '';
  const ft = facts(r).filter(([k, v]) => v !== nm);   /* 큰 제목과 같은 값은 두 번 안 적습니다 */

  return {
    title: `${nm} · ${c.name} · OPUSCLAM`,
    desc: plain(desc, 155) || `${nm} — ${c.name.replace('DB', '')} 정보`,
    image: r.image_url || r.logo_url || '',
    canonical: `${SITE}${c.view}?id=${encodeURIComponent(id)}`,
    body:
      `<h1>${esc(nm)}</h1>`
      + (ft.length
          ? '<dl>' + ft.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>'
          : '')
      + (desc ? `<section><h2>소개</h2><p>${esc(plain(desc, 4000))}</p></section>` : '')
      + `<p><a href="${SITE}${c.list}">${esc(c.name)} 목록</a></p>`,
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
.pg{margin:22px 0;line-height:2}.pg h2{display:inline;font-size:14px;margin-right:8px}
.pg a{margin-right:4px}.pg b{margin-right:4px;color:#111}
</style>
</head>
<body>
${d.body}
<p><a href="${esc(d.canonical)}">OPUSCLAM 에서 자세히 보기</a></p>
<script>
/* ★★ 2026-08-19 고침 — <b>/api/seo 로 곧바로 온 사람만</b> 보냅니다.
     미들웨어가 들어온 뒤로는 주소가 /db/person-view.html 그대로인 채
     이 HTML 이 나갑니다. 그때도 새로 고치면 <b>같은 주소로 스스로를
     불러 제자리를 맴돕니다.</b> 구글은 자바스크립트를 돌리므로
     이것을 「자기 자신으로 넘김」으로 볼 수 있습니다.
   ★ 정규식을 쓰지 않고 글자 자리만 봅니다. */
(function () {
  /* ★ 주소 끝에 &raw=1 을 붙이면 <b>보내지 않고 그대로 보여 줍니다.</b>
       파트너가 눈으로 확인할 때 씁니다. */
  if (location.search.indexOf('raw=1') !== -1) return;
  if (location.pathname.indexOf('/api/seo') === 0) {
    location.replace(${JSON.stringify(d.canonical)});
  }
})();
</script>
</body>
</html>`;
}

/* ── 들어오는 곳 ─────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'opusclam.com'}`);
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');

    let d = null;

    /* ★★ 2026-08-19 · 목록 화면 — `kind=person-list` · `kind=work-list`
         쪽 번호는 `p`, 없으면 첫 쪽입니다. */
    if (kind && kind.slice(-5) === '-list' && LISTS[kind.slice(0, -5)]) {
      const raw = url.searchParams.get('p') || '1';
      /* 숫자가 아니거나 0 이하면 <b>첫 쪽</b>으로 봅니다 — 404 로 두면
         잘못 만든 링크 하나에 목록 전체가 끊깁니다. */
      const page = /^[0-9]+$/.test(raw) ? Math.max(1, parseInt(raw, 10)) : 1;
      d = await list(kind.slice(0, -5), page);
    } else {
      /* ★ 번호가 없거나 숫자가 아니면 <b>색인하지 않습니다</b> —
           목록으로 보내면 같은 내용이 여러 주소로 잡힙니다. */
      if (!id || !/^\d+$/.test(id)) {
        res.setHeader('X-Robots-Tag', 'noindex');
        res.status(404).send('not found');
        return;
      }
      if (kind === 'person') d = await person(id);
      else if (kind === 'work') d = await work(id);
      /* ★ 2026-08-19 · 나머지 여섯 갈래는 공통 함수가 그립니다 */
      else if (LISTS[kind]) d = await entity(kind, id);
    }

    /* 없는 번호 · 숨긴 인물 → 404 로 알립니다.
       ★ 200 으로 빈 화면을 주면 구글이 <b>빈 페이지를 색인</b>합니다. */
    if (!d || d.skip) {
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send('not found');
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    /* ★★ 2026-08-19 고침 — <b>담아 두지 않습니다.</b>
         미들웨어가 봇만 이리로 보내는데, 그 응답이 CDN 에 담기면
         사람이 같은 주소(/db/person-view.html?id=1)로 왔을 때
         <b>봇용 맨화면을 볼 위험</b>이 있습니다. Vary 로 갈라 보려 해도
         CDN 이 정말 갈라 주는지 확신할 수 없어, 아예 담지 않습니다.
         구글이 한 화면을 몇 날에 한 번 가져가는 정도라 밑지지 않습니다. */
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'User-Agent');
    res.status(200).send(page(d));
  } catch (e) {
    /* ★ 실패하면 <b>500 을 줍니다.</b> 빈 화면을 200 으로 주면
         구글이 그것을 색인해 버립니다. 500 이면 나중에 다시 옵니다. */
    res.setHeader('X-Robots-Tag', 'noindex');
    /* ★ 주소 끝에 &raw=1 을 붙였을 때만 <b>까닭을 보여 줍니다.</b>
         봇에게는 여전히 `error` 넉 자뿐입니다. */
    const raw = String(req.url || '').indexOf('raw=1') !== -1;
    res.status(500).send(raw ? 'error · ' + (e && e.message ? e.message : String(e)) : 'error');
  }
}
