/* ============================================================
   OPUSCLAM 아르코 공모 갱신 — seed/arko-collect.mjs

   무엇을 하나
    · 한국문화예술위원회(아르코)의 「문예진흥기금 공모 한눈에 보기」 를 읽어
      정보SPOT 「지원금」 갈래의 공모 일정을 갱신합니다

   왜 필요한가
    아르코 공모는 해마다 새로 열립니다. 지금 담긴 20건의 마감일은
    2025년 9~12월이라 이미 지났고, 2027년 공모는 2026년 9월 무렵 나옵니다.
    그때 손으로 20건을 다시 고치지 않으려고 만들었습니다.

   어떻게 새 연도를 찾나
    아르코 페이지에는 연도 탭(2026·2025·2024·2023)이 있습니다.
    시작 페이지를 읽어 그 탭에서 <b>가장 큰 연도</b>를 골라 따라갑니다.
    그래서 2027년 페이지가 생기면 저절로 그쪽을 읽습니다.
    탭을 찾지 못하면 시작 페이지를 그대로 읽습니다.

   이미 담긴 것은 어떻게 되나
    arko_key(아르코 쪽 사업명)로 짝을 맞춥니다.
      · 짝이 있으면 <b>마감일·기간만 갱신</b> — 우리가 쓴 설명은 그대로 둡니다
      · 짝이 없으면 새 사업으로 담습니다 (설명은 나중에 채우시면 됩니다)
    없어진 사업은 지우지 않고 그대로 둡니다 — 지난 공모도 다음 공모를
    짐작하는 데 쓸모가 있습니다.

   합법 여부
    이 페이지는 공공누리(공공저작물 자유이용)입니다.

   쓰는 법
     node seed/arko-collect.mjs                     새 연도를 찾아 갱신
     node seed/arko-collect.mjs --dry               담지 않고 보기만
     node seed/arko-collect.mjs --url=…/content/NNNN  페이지를 직접 지정
     node seed/arko-collect.mjs --year=2027         그 연도 탭을 골라 읽기
     node seed/arko-collect.mjs --dry --debug       무엇을 읽었는지 자세히 보기
     node seed/arko-collect.mjs --all               문학·시각예술까지 다 담기

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const DRY = !!args.dry;
const DEBUG = !!args.debug;
const ALL = !!args.all;   /* 문학·시각예술까지 다 담기 */
const WANT_YEAR = args.year ? Number(args.year) : null;

/* 2026년 공모 페이지 — 여기서 시작해 연도 탭을 따라갑니다 */
const START = args.url ? String(args.url) : 'https://www.arko.or.kr/content/6123';
const BASE = 'https://www.arko.or.kr';
const UA = 'OpusclamArkoBot/1.0 (https://opusclam.com)';

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.text();
}

/* ============================================================
   글자 다듬기
   ============================================================ */
function strip(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* ============================================================
   연도 탭에서 가장 큰 연도를 찾습니다

   페이지에 「2026 · 2025 · 2024 · 2023」 같은 링크가 있습니다.
   2027년 페이지가 생기면 그 링크가 늘어나므로, 가장 큰 연도를 고릅니다.
   ============================================================ */
function findYearLinks(html) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']*\/content\/\d+)["'][^>]*>\s*(20\d\d)\s*<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].charAt(0) === '/' ? BASE + m[1] : m[1];
    out.push({ year: Number(m[2]), url: href });
  }
  /* 같은 연도가 여러 번 나오면 하나만 */
  const seen = new Set(), uniq = [];
  for (const x of out) {
    if (seen.has(x.year)) continue;
    seen.add(x.year); uniq.push(x);
  }
  return uniq.sort((a, b) => b.year - a.year);
}

/* ============================================================
   표에서 사업명과 신청기간을 뽑습니다

   구조가 조금 달라도 견디도록 느슨하게 읽습니다.
     · 링크가 있는 칸  → 사업명
     · 날짜가 있는 칸  → 신청기간
   분야 칸은 읽지 않습니다 — 우리 쪽 구분은 따로 정해 두었습니다.
   ============================================================ */
/* ============================================================
   이미지맵에서 사업명을 읽습니다 — 이 페이지의 진짜 짜임

   아르코의 「한눈에 보기」 는 표가 아니라 <b>그림 한 장</b>입니다.
   GIF 위에 누를 수 있는 자리(<area>)를 얹은 이미지맵이고,
   사업명은 그 자리의 title 에 적혀 있습니다.

     <img src="…1809934….gif" usemap="#notice-250923">
     <area title="공연예술 창작산실(올해의신작) 새창열림" href="https://artnuri.or.kr/…">

   표는 <div class="hide"> 안에 눈이 불편한 분을 위해 숨겨져 있습니다.
   그래서 표만 읽으면 일부만 잡혔습니다.

   여기서는 두 곳을 함께 읽어 합칩니다.
     · 이미지맵 — 사업명과 상세 공고 링크 (온전히 얻습니다)
     · 숨은 표  — 신청기간
   ============================================================ */

/* 사업명 앞에 붙는 분야 — 떼어낼 것만 골라 적습니다.

   ★ 모두 떼면 안 됩니다.
     「시각예술 창작산실」 과 「다원예술 창작산실」 은 접두어를 떼면
     둘 다 「창작산실」 이 되어 구분할 수 없습니다.
     그래서 우리 열쇠에 접두어가 없는 분야만 떼어냅니다.

       공연예술 창작산실(올해의신작)  →  창작산실(올해의신작)   (뗌)
       국제교류 해외레지던시참가지원  →  해외레지던시참가지원   (뗌)
       다원예술 창작산실              →  다원예술 창작산실       (남김)
       시각예술 창작산실              →  시각예술 창작산실       (남김)

   「공연예술대관료지원」 처럼 공백이 없는 것은 이름의 일부이므로 건드리지 않습니다. */
const FIELD_PREFIX = ['공연예술', '국제교류'];

function cleanAreaTitle(t) {
  let x = String(t || '')
    .replace(/\s*새창열림\s*$/, '')       /* 「… 새창열림」 꼬리 */
    .replace(/\s*새\s*창\s*열림\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  /* 분야 접두어 떼기 (공백으로 갈린 것만) */
  for (const f of FIELD_PREFIX) {
    if (x.startsWith(f + ' ')) { x = x.slice(f.length + 1).trim(); break; }
  }
  /* 괄호 앞뒤 공백 다듬기 — 우리 열쇠와 맞추기 위해 */
  return x.replace(/\s+\(/g, '(').replace(/\(\s+/g, '(')
          .replace(/\s+\)/g, ')').replace(/\s*·\s*/g, '·').trim();
}

/* 클래식 음악과 무관한 분야 — 기본으로 담지 않습니다.

   정보SPOT 은 클래식 음악 정보 자리이므로 문학·시각예술 사업은 뺐습니다.
   (지금 담긴 20건도 같은 기준으로 골랐습니다)
   다 담고 싶으시면 --all 을 붙이시면 됩니다. */
const OFF_TOPIC = /(문학|소설|시각\s*예술)/;

/* 사업이 아닌 자리 — 설명자료·신청·영상 링크 */
function isNotProgram(t) {
  return /(설명자료|미리보기|다운로드|바로가기|영상|유튜브|youtu|보기$)/.test(String(t || ''));
}

function parseAreas(html, debug) {
  const out = [];
  const areas = html.match(/<area[^>]*>/gi) || [];
  if (debug) console.log(`  [살펴보기] 이미지맵 자리 ${areas.length}개`);

  for (const a of areas) {
    const t = (a.match(/title=["']([^"']+)["']/i) || [])[1]
           || (a.match(/alt=["']([^"']+)["']/i) || [])[1] || '';
    const href = (a.match(/href=["']([^"']+)["']/i) || [])[1] || '';
    const name = cleanAreaTitle(t);
    if (!name || name.length < 3) continue;
    if (isNotProgram(name)) continue;
    if (isFieldWord(name)) continue;
    if (!ALL && OFF_TOPIC.test(name)) continue;   /* 문학·시각예술은 기본으로 뺍니다 */
    if (out.some((x) => x.name === name)) continue;
    out.push({ name: name, link: href, period: '' });
  }
  if (debug) console.log(`  [살펴보기] 이미지맵에서 읽은 사업 ${out.length}개`);
  return out;
}

/* 분야 이름 — 사업명이 아닙니다.
   아르코 페이지의 분야 칸에도 링크가 붙어 있어 사업명으로 잡히던 일이 있었습니다.
   분야는 종류가 정해져 있으므로 이름으로 걸러내는 것이 가장 확실합니다. */
const FIELD_WORDS = [
  '문학', '시각 예술', '시각예술', '다원 예술', '다원예술',
  '공연 예술', '공연예술', '어린이 청소년', '어린이청소년',
  '청년', '국제', '지역', '전 장르', '전장르', '모든 장르',
  '분야', '구분', '사업명', '지원사업명', '지원신청', '지원신청 기간', '비고',
];
function isFieldWord(t) {
  const x = String(t || '').replace(/\s+/g, '');
  return FIELD_WORDS.some((w) => w.replace(/\s+/g, '') === x);
}

function parseRows(html, debug) {
  const rows = [];
  const trs = html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || [];
  if (debug) {
    const tables = (html.match(/<table[\s>]/gi) || []).length;
    console.log(`  [살펴보기] 표 ${tables}개 · 행 ${trs.length}개`);
  }

  for (const tr of trs) {
    const tds = tr.match(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi) || [];
    if (tds.length < 2) continue;

    /* ── 사업명 칸 찾기 ──────────────────────────────────

       두 가지를 함께 다뤄야 했습니다.

       ① 사업명이 링크 안팎에 걸쳐 있습니다
            <td><a>창작산실</a>(올해의신작)</td>
          링크 글자만 읽으면 「창작산실」 이 되어 여러 사업이 같은 이름이 됩니다.
          그래서 <b>칸 전체 글자</b>를 사업명으로 씁니다.

       ② 한 칸에 사업이 여럿 묶여 있습니다
            <td><a>창작산실</a>(올해의신작)<br><a>창작산실</a>(2차 제작지원)</td>
          그래서 칸을 <br> 로 나누어 조각마다 하나의 사업으로 봅니다.
          이 짜임을 몰라 26개 가운데 14개만 읽던 일이 있었습니다.
       ────────────────────────────────────────────────── */
    let period = '', plain = '';

    /* 먼저 신청기간 칸을 찾습니다 */
    for (const td of tds) {
      const text = strip(td);
      if (!text) continue;
      const hasDate = /\d{4}\s*\.\s*\d{1,2}|\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*\(|예정|미정|마감/.test(text);
      if (hasDate && !period) period = text;
    }

    /* 사업명 조각을 모읍니다 */
    const names = [];
    for (const td of tds) {
      /* 링크가 없는 칸(분야·기간)은 건너뜁니다 */
      if (!/<a[^>]+href=/i.test(td)) {
        const t = strip(td);
        if (t && !isFieldWord(t) && !plain
            && !/\d{4}\s*\.\s*\d{1,2}|예정|미정|마감/.test(t)
            && t.length >= 4 && t.length <= 60) plain = t;
        continue;
      }
      /* 칸을 <br> 로 나누어 조각마다 하나의 사업으로 봅니다 */
      const pieces = td
        .replace(/<t[dh][^>]*>|<\/t[dh]>/gi, '')
        .split(/<br\s*\/?>/i);
      for (const piece of pieces) {
        const a = piece.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!a) continue;
        const href = a[1];
        if (href === '#' || href.charAt(0) === '#') continue;
        const inner = strip(a[2]);
        if (/^20\d\d$/.test(inner)) continue;          /* 연도 탭 */
        /* 조각 전체 글자 — 링크 밖의 괄호까지 함께 담습니다 */
        const whole = strip(piece);
        let nm = whole.length >= inner.length ? whole : inner;
        /* 태그를 지우면서 괄호 앞에 공백이 생깁니다.
             <a>창작산실</a>(올해의신작)  →  「창작산실 (올해의신작)」
           아르코 표기는 공백이 없으므로 다듬습니다 — 그러지 않으면
           이미 담긴 항목과 짝이 맞지 않습니다. */
        nm = nm.replace(/\s+\(/g, '(').replace(/\(\s+/g, '(')
               .replace(/\s+\)/g, ')').replace(/\s*·\s*/g, '·')
               .replace(/\s{2,}/g, ' ').trim();
        if (nm.length < 3) continue;
        if (isFieldWord(nm) || isFieldWord(inner)) continue;
        names.push({ name: nm, link: href.charAt(0) === '/' ? BASE + href : href });
      }
    }

    /* 링크가 아예 없는 표라면 글자 칸을 사업명으로 씁니다 */
    if (!names.length && plain && !isFieldWord(plain)) {
      names.push({ name: plain, link: '' });
    }
    if (!names.length) continue;
    /* 표에서 여러 사업이 기간 칸을 함께 쓰는 일이 많습니다.
       기간이 비어 있으면 바로 앞 사업의 기간을 물려받습니다. */
    if (!period && rows.length) period = rows[rows.length - 1].period;

    if (debug) {
      console.log(`      칸 ${tds.length}개 | 사업 ${names.length}개 | 기간 「${(period || '').slice(0, 30)}」`);
      names.forEach((x) => console.log(`          └ ${x.name}`));
    }
    for (const x of names) {
      /* 같은 사업이 두 번 담기지 않게 */
      if (rows.some((r) => r.name === x.name)) continue;
      rows.push({ name: x.name, link: x.link, period: period });
    }
  }
  if (debug) {
    /* 표가 아니라 목록(ul/li)으로 짜였을 수도 있어 함께 살펴봅니다 */
    const lis = (html.match(/<li[\s>][\s\S]*?<\/li>/gi) || []).length;
    console.log(`  [살펴보기] 표에서 읽은 사업 ${rows.length}개 · 목록(li) ${lis}개`);
  }
  return rows;
}

/* ============================================================
   신청기간 글자에서 날짜를 뽑습니다

   보기
     2025.9.23.(화) 10:00 ~ 10.30.(목) 15:00 마감  → 2025-09-23 ~ 2025-10-30
     2025.12.1.(월) ~ 2026.2.27.(금) 15:00 마감    → 2025-12-01 ~ 2026-02-27
     2026년 상반기 예정                             → 날짜 없음
   ============================================================ */
function parsePeriod(text) {
  const t = String(text || '');
  const pad = (n) => String(n).padStart(2, '0');

  /* 연도가 붙은 날짜를 모두 찾습니다 */
  const full = [...t.matchAll(/(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/g)]
    .map((m) => ({ y: +m[1], mo: +m[2], d: +m[3], at: m.index, len: m[0].length }));

  if (!full.length) return { from: null, to: null, text: t };

  const first = full[0];
  const from = `${first.y}-${pad(first.mo)}-${pad(first.d)}`;

  /* 마감일 — 연도가 붙은 두 번째 날짜가 있으면 그것,
     없으면 연도 없이 적힌 날짜(10.30 같은)를 첫 날짜의 연도로 읽습니다 */
  let to = null;
  if (full.length > 1) {
    const last = full[full.length - 1];
    to = `${last.y}-${pad(last.mo)}-${pad(last.d)}`;
  } else {
    /* 첫 날짜 전체를 건너뛰어야 합니다.
       예전에는 네 글자만 건너뛰어 「2025.9.23」 의 「9.23」 을
       마감일로 잘못 읽었습니다. */
    const tail = t.slice(first.at + first.len);
    const m2 = tail.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\(/);
    if (m2) {
      let y = first.y, mo = +m2[1], d = +m2[2];
      /* 달이 뒤로 가지 않으면 해가 넘어간 것입니다 */
      if (mo < first.mo) y += 1;
      to = `${y}-${pad(mo)}-${pad(d)}`;
    }
  }
  return { from: from, to: to, text: t };
}

/* 짧은 날짜 표기 — 목록의 좁은 칸에 들어갑니다 */
function shortDeadline(p) {
  if (p.to) {
    const [y, m, d] = p.to.split('-');
    return `${y.slice(2)}.${m}.${d} 마감`;
  }
  if (/상반기/.test(p.text)) return '상반기 예정';
  if (/하반기/.test(p.text)) return '하반기 예정';
  if (/(예정|미정)/.test(p.text)) return '일정 미정';
  return '그 해 공고 확인';
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 아르코 공모 갱신 ──');

  /* ① 시작 페이지를 읽고 연도 탭에서 가장 큰 연도를 고릅니다 */
  let pageUrl = START, pageYear = null;
  try {
    const html0 = await getHtml(START);
    const years = findYearLinks(html0);
    if (years.length) {
      console.log('연도 탭 : ' + years.map((y) => y.year).join(' · '));
      const pick = WANT_YEAR ? years.find((y) => y.year === WANT_YEAR) : years[0];
      if (pick) { pageUrl = pick.url; pageYear = pick.year; }
      else if (WANT_YEAR) {
        console.log(`  ${WANT_YEAR}년 탭이 없습니다 — 시작 페이지를 그대로 읽습니다`);
      }
    } else {
      console.log('연도 탭을 찾지 못했습니다 — 시작 페이지를 그대로 읽습니다');
    }
  } catch (e) {
    console.error('시작 페이지를 읽지 못했습니다:', e.message);
    process.exit(1);
  }

  console.log(`읽는 곳 : ${pageUrl}${pageYear ? ` (${pageYear}년)` : ''}${DRY ? ' · 담지 않음(dry)' : ''}`);

  /* ② 표를 읽습니다 */
  let rows = [];
  try {
    const html = await getHtml(pageUrl);
    if (DEBUG) console.log(`  [살펴보기] 받은 글자 ${html.length}자`);

    /* ① 이미지맵에서 사업명과 링크를 읽습니다 (여기가 온전합니다) */
    const areas = parseAreas(html, DEBUG);
    /* ② 숨은 표에서 신청기간을 읽습니다 */
    const table = parseRows(html, DEBUG);

    /* ③ 합칩니다 — 이름이 같은 것끼리 짝지어 기간을 채웁니다 */
    const nk = (v) => String(v || '').replace(/[\s·—–\-()]/g, '').toLowerCase();
    const periodBy = {};
    for (const t of table) {
      if (!t.period) continue;
      periodBy[nk(t.name)] = t.period;
      /* 표의 이름에 분야가 붙어 있을 수도 있어 떼어낸 이름으로도 담아 둡니다 */
      periodBy[nk(cleanAreaTitle(t.name))] = t.period;
    }

    if (areas.length) {
      rows = areas.map((a) => ({
        name: a.name, link: a.link,
        period: periodBy[nk(a.name)] || '',
      }));
      /* 표에만 있는 사업(별도공모 등)도 놓치지 않습니다 */
      for (const t of table) {
        const nm = cleanAreaTitle(t.name);
        if (!ALL && OFF_TOPIC.test(nm)) continue;
        const key = nk(nm);
        if (rows.some((r) => nk(r.name) === key)) continue;

        /* 숨은 표에는 구분이 빠진 짧은 이름이 섞여 있습니다.
             그림  : 창작산실(올해의신작) · 창작산실(2차 제작지원) …
             표    : 창작산실                ← 구분이 없습니다
           이미 담은 사업의 앞부분과 같으면 그것을 뭉뚱그린 이름이므로
           새 사업으로 담지 않습니다. */
        if (rows.some((r) => nk(r.name).startsWith(key) && nk(r.name) !== key)) continue;

        rows.push({ name: nm, link: t.link, period: t.period });
      }
    } else {
      rows = table;
    }
    if (DEBUG) {
      const withP = rows.filter((r) => r.period).length;
      console.log(`  [살펴보기] 합친 결과 ${rows.length}개 · 기간을 찾은 것 ${withP}개`);
    }
  } catch (e) {
    console.error('페이지를 읽지 못했습니다:', e.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.log('\n표에서 사업을 찾지 못했습니다.');
    console.log('아르코가 페이지 짜임을 바꾼 것일 수 있습니다 — 알려 주시면 읽는 규칙을 고치겠습니다.');
    process.exit(1);
  }
  console.log(`찾은 사업 : ${rows.length}개\n`);

  /* ③ 이미 담긴 것을 불러 짝을 맞춥니다 */
  const have = (await sb('spot?select=id,title,arko_key,deadline_text&section=eq.'
    + encodeURIComponent('지원금') + '&arko_key=not.is.null&limit=200')) || [];
  /* 짝을 맞출 때 공백과 기호 차이는 무시합니다.
     아르코 표기가 조금 달라져도(「창작산실(올해의신작)」 ↔ 「창작산실 (올해의 신작)」)
     같은 사업으로 알아보게 하려는 것입니다. */
  const norm = (v) => String(v || '').replace(/[\s·—–\-()]/g, '').toLowerCase();
  const byKey = {};
  for (const h of have) byKey[norm(h.arko_key)] = h;

  let upd = 0, add = 0, same = 0;

  for (const r of rows) {
    const p = parsePeriod(r.period);
    const dl = shortDeadline(p);
    const found = byKey[norm(r.name)];

    if (found) {
      /* 기간을 읽지 못했으면 건드리지 않습니다 —
         그림에서 사업명은 얻었지만 기간은 표에만 있어서,
         못 읽었을 때 덮어쓰면 이미 담긴 올바른 날짜를 잃습니다. */
      if (!p.from && !/(예정|미정)/.test(r.period || '')) { same++; continue; }
      if (found.deadline_text === dl) { same++; continue; }
      console.log(`  [갱신] ${r.name}`);
      console.log(`         ${found.deadline_text || '(없음)'} → ${dl}`);
      if (!DRY) {
        try {
          await sb(`spot?id=eq.${found.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              deadline_text: dl,
              date_from: p.from, date_to: p.to,
              link_url: r.link || undefined,
            }),
          });
          upd++;
        } catch (e) { console.log(`         갱신 실패: ${e.message}`); }
      } else upd++;
      continue;
    }

    /* 새 사업 — 설명은 비워 두고 담습니다 (나중에 채우시면 됩니다) */
    console.log(`  [새 사업] ${r.name}  ·  ${dl}`);
    if (!DRY) {
      try {
        await sb('spot', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            section: '지원금', region: '국내', country: '대한민국',
            category: '창작지원',
            title: '아르코 ' + r.name,
            arko_key: r.name,
            body: '<p>한국문화예술위원회(아르코)의 문예진흥기금 지원사업입니다.</p>'
                + '<h3>알아두면 좋은 것</h3><table>'
                + `<tr><th>지원신청</th><td>${r.period || '공식 홈페이지 확인'}</td></tr>`
                + '<tr><th>신청</th><td>국가문화예술지원시스템 (NCAS)</td></tr>'
                + '</table>'
                + '<p>자세한 안내는 아르코 공고문에서 확인하실 수 있습니다.</p>',
            date_from: p.from, date_to: p.to,
            deadline_text: dl,
            organizer: '한국문화예술위원회 (아르코)',
            link_url: r.link || 'https://www.arko.or.kr/',
            source: '한국문화예술위원회 「문예진흥기금 공모 한눈에 보기」',
            source_url: pageUrl,
            keywords: '아르코,' + r.name + ',문예진흥기금,지원사업,NCAS',
            logo_text: '아르코',
            author_name: '오퍼스클램',
            hidden: false,
          }]),
        });
        add++;
      } catch (e) { console.log(`           담기 실패: ${e.message}`); }
    } else add++;
  }

  console.log('\n── 끝 ──');
  console.log(`갱신 ${upd}건 · 새 사업 ${add}건 · 그대로 ${same}건`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
  if (add) console.log('※ 새 사업에는 간단한 설명만 넣었습니다 — 필요하시면 뒤에 채우시면 됩니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
