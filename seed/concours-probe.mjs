#!/usr/bin/env node
/* ============================================================
   콩쿠르 입상자 — 될지 안 될지 <b>먼저 봅니다</b>
   seed/concours-probe.mjs
   ------------------------------------------------------------
   2026-08-15 · 파트너 요청 (두 번째 시도)

   ★ 왜 「수집기」가 아니라 「시험 도구」인가
     파트너가 예전에 한 번 시도해 하루를 쓰고 접으셨습니다.
     그러니 이번에는 <b>만들기 전에 될지부터</b> 봅니다.
     쇼팽 콩쿠르 19회를 받아, 몇 회를 읽어낼 수 있는지만 셉니다.
     담지 않습니다. Supabase 를 건드리지 않습니다.

   ★ 그때 막힌 까닭으로 짐작되는 것
     위키 문서를 <b>다듬어진 글</b>로 받으면 표가 첫 줄에서 잘립니다.
     제7회를 받아 보면 「1st | 40,000」에서 끝나고 아르헤리치 이름조차
     나오지 않습니다.
     ▶ 그래서 <b>action=raw</b> 로 원문을 받습니다. 다듬기 전 글이라
       표가 온전하고, 칸이 「|」로 또렷이 나뉘어 오히려 읽기 쉽습니다.

   ★ 대회마다 표 짜임이 다릅니다 — 이것이 진짜 어려움입니다
     같은 쇼팽 콩쿠르인데도 회마다 다릅니다.
       제7회  {{…prize|1st|40,000|[[Martha Argerich]]|Argentina}}
       제3회  1st: 5,000zł; Yakov Zak; Soviet Union
       제9회  둘이 섞임
     ▶ 그래서 <b>세 가지 꼴</b>을 모두 시험합니다. 어느 것도 안 맞으면
       그 회는 「못 읽음」으로 셉니다. 억지로 맞히지 않습니다.

   ★ 판단 기준 (파트너와 정한 것)
     · 15회 넘게 읽히면 → 다른 대회로 넓힙니다
     · 절반도 안 되면  → 접습니다

   쓰는 법
     node seed/concours-probe.mjs            결과만
     node seed/concours-probe.mjs --dump     읽어낸 입상자를 눈으로
     node seed/concours-probe.mjs --raw=7    제7회 원문을 그대로 (짜임 확인용)
   ============================================================ */

const ARGS = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const DUMP = !!ARGS.dump;
const SAVE = !!ARGS.save;
const DIAG = !!ARGS.diag;      /* 못 읽은 회의 원문 문형 보기 */

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RAW = ARGS.raw ? String(ARGS.raw) : null;

const UA = 'OpusclamBot/1.0 (+https://opusclam.com; classical music database)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 쇼팽 콩쿠르는 로마 숫자로 문서 이름을 씁니다 */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX'];

/* 반 클라이번은 <b>영어 서수 낱말</b>로 문서 이름을 씁니다 */
const ORDINAL = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
  'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth',
  'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth'];

/* 반 클라이번 회차 → 열린 해
   ★ 넉 해마다 열리지만 <b>고르지 않습니다</b> — 3회는 3년 만에(1969),
     16회는 코로나로 한 해 미뤄져 2022 입니다. 그래서 계산하지 않고
     적어 둡니다. 문서에서 읽은 값이 있으면 그것을 먼저 씁니다. */
const CLIBURN_YEARS = {
  1: 1962, 2: 1966, 3: 1969, 4: 1973, 5: 1977, 6: 1981, 7: 1985, 8: 1989,
  9: 1993, 10: 1997, 11: 2001, 12: 2005, 13: 2009, 14: 2013, 15: 2017,
  16: 2022, 17: 2025,
};

/* ══ 대회 목록 ═══════════════════════════════════════════════
   ★ 대회마다 문서 짜임이 <b>크게 다릅니다.</b> 두 가지가 있습니다 —

     ① 회차별 문서 (쇼팽)
        「IX International Chopin Piano Competition」처럼 회마다 문서가
        따로 있고, 그 안에 그 회 입상자 표가 있습니다.

     ② 한 문서에 전 회차 (차이콥스키·퀸 엘리자베스 등)
        한 문서 안에 <b>연도가 줄이 되는</b> 큰 표가 있습니다.
            | 1958 | Van Cliburn (USA) | Lev Vlassenko (USSR) …
        칸 하나에 여러 사람이 들어가기도 합니다.

   ▶ 어느 쪽인지 kind 로 적어 둡니다. 새 대회를 더할 때는 여기 한 줄만
     쓰면 됩니다. */
const COMPS = [
  {
    key: 'chopin', kind: 'per-edition',
    nameKo: '쇼팽 국제 피아노 콩쿠르',
    nameEn: 'International Chopin Piano Competition',
    field: '피아노',
    editions: 19,
    title: (no) => `${ROMAN[no]} International Chopin Piano Competition`,
    years: {
      1:1927, 2:1932, 3:1937, 4:1949, 5:1955, 6:1960, 7:1965, 8:1970, 9:1975,
      10:1980, 11:1985, 12:1990, 13:1995, 14:2000, 15:2005, 16:2010, 17:2015,
      18:2021, 19:2025,
    },
  },
  {
    key: 'tchaikovsky', kind: 'one-page',
    nameKo: '차이콥스키 국제 콩쿠르',
    nameEn: 'International Tchaikovsky Competition',
    field: '피아노·바이올린·첼로·성악',
    title: () => 'International Tchaikovsky Competition',
  },
  {
    key: 'queen-elisabeth', kind: 'one-page',
    nameKo: '퀸 엘리자베스 콩쿠르',
    nameEn: 'Queen Elisabeth Competition',
    field: '바이올린·피아노·성악·첼로',
    title: () => 'Queen Elisabeth Competition',
  },
  /* ★ 반 클라이번 — 되살렸습니다 (2026-08-17)
       ─────────────────────────────────────────────────────────
       ① 문서가 <b>회차마다 따로</b>입니다. 그런데 쇼팽처럼 로마 숫자가
          아니라 <b>영어 서수 낱말</b>입니다 —
              Sixteenth Van Cliburn International Piano Competition
       ② 게다가 표가 아니라 <b>문장 속</b>에 적혀 있습니다 —
              It was won by X, while Y and Z were awarded
              the silver and bronze medals respectively.
          그래서 표를 읽는 네 가지 꼴로는 한 명도 못 잡았습니다.
       ▶ 서수 낱말 문서명(kind: 'per-edition-word')과
         문장을 읽는 다섯째 꼴(parseProse)을 더했습니다.
       ★ 문서 이름이 회마다 다를 수 있어 <b>후보를 여럿</b> 두고 차례로
         두드립니다. 하나라도 열리면 그것을 씁니다.
       ★ 본 문서(mainTitle)도 <b>함께</b> 읽어 합칩니다. 회차 문서가
         없는 회를 본 문서 표가 채워 주기 때문입니다. */
  {
    key: 'cliburn', kind: 'per-edition-word',
    nameKo: '반 클라이번 국제 피아노 콩쿠르',
    nameEn: 'Van Cliburn International Piano Competition',
    field: '피아노',
    editions: 17,
    mainTitle: 'Van Cliburn International Piano Competition',
    titles: (no) => [
      `${ORDINAL[no]} Van Cliburn International Piano Competition`,
      `${CLIBURN_YEARS[no]} Van Cliburn International Piano Competition`,
      `Van Cliburn International Piano Competition ${CLIBURN_YEARS[no]}`,
    ],
    title: () => 'Van Cliburn International Piano Competition',
    years: CLIBURN_YEARS,
  },
  {
    key: 'leeds', kind: 'one-page',
    nameKo: '리즈 국제 피아노 콩쿠르',
    nameEn: 'Leeds International Piano Competition',
    field: '피아노',
    title: () => 'Leeds International Piano Competition',
  },
  {
    key: 'busoni', kind: 'one-page',
    nameKo: '부조니 국제 피아노 콩쿠르',
    nameEn: 'Ferruccio Busoni International Piano Competition',
    field: '피아노',
    title: () => 'Ferruccio Busoni International Piano Competition',
  },
];

/* 회차 → 열린 해 (문서에서 못 읽을 때 쓰는 대조표)
   ★ 지어낸 것이 아니라 널리 알려진 사실입니다. 다만 문서에서 읽어낸
     값을 <b>먼저</b> 쓰고, 이것은 못 읽었을 때만 씁니다. */
const YEARS = {
  1: 1927, 2: 1932, 3: 1937, 4: 1949, 5: 1955, 6: 1960, 7: 1965, 8: 1970,
  9: 1975, 10: 1980, 11: 1985, 12: 1990, 13: 1995, 14: 2000, 15: 2005,
  16: 2010, 17: 2015, 18: 2021, 19: 2025,
};

async function raw(title) {
  const url = 'https://en.wikipedia.org/w/index.php?title='
    + encodeURIComponent(title) + '&action=raw';
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

/* [[Martha Argerich]] · [[Martha Argerich|Argerich]] · Martha Argerich */
function clean(s) {
  return String(s || '')
    /* ★ 위키 표는 칸에 꾸밈을 붙입니다 —
         「rowspan="8" | 이름」·「align="center" |€25,000」
       「|」 앞의 속성 부분을 걷어내지 않으면 그것이 통째로 이름이 됩니다
       (첫 시험에서 「rowspan="8" | · Yuri Bryushkov」가 나왔습니다). */
    .replace(/^\s*(?:[a-z-]+\s*=\s*"[^"]*"\s*)+\|/i, '')
    .replace(/^\s*(?:[a-z-]+\s*=\s*'[^']*'\s*)+\|/i, '')
    .replace(/^\s*(?:[a-z-]+\s*=\s*[\w:;#%.-]+\s*)+\|/i, '')
    .replace(/<br\s*\/?>/gi, ' ')
    /* ★ 그림은 <b>통째로</b> 지웁니다 — [[File:Gold medal.svg|20px]]
         일반 링크보다 <b>먼저</b> 해야 합니다. 나중에 하면 「20px」만
         남아 그것이 이름이 됩니다(시험에서 잡았습니다). */
    .replace(/\[\[(?:File|Image|파일|그림):[^\]]*\]\]/gi, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    /* ★★ 틀을 <b>통째로 지우면 안 됩니다</b> (2026-08-15 · 제9회 원문을
         보고 알았습니다). 위키 표는 등수·나라·이름을 <b>틀로</b> 씁니다 —
             !{{Gold1}}                  ← 1위
             |{{flag|Poland|1928}}       ← 나라
             |{{ill|Tatyana Fedkina|pl}} ← 이름
         지우면 등수와 나라가 빈칸이 되어 그 회를 통째로 놓칩니다.
       ▶ 아는 틀은 <b>속을 꺼내</b> 쓰고, 모르는 틀만 지웁니다. */
    .replace(/\{\{\s*Gold1?\s*\}\}/gi, '1st')
    .replace(/\{\{\s*Silver2?\s*\}\}/gi, '2nd')
    .replace(/\{\{\s*Bronze3?\s*\}\}/gi, '3rd')
    /* {{flag|Poland|1928}} · {{flagicon|USA}} → 첫 값이 나라 이름 */
    .replace(/\{\{\s*flag(?:icon|country)?\s*\|\s*([^|}]+)[^}]*\}\}/gi, '$1')
    /* {{ill|이름|pl|다른말이름}} → 첫 값이 우리가 쓸 이름 */
    .replace(/\{\{\s*ill\s*\|\s*([^|}]+)[^}]*\}\}/gi, '$1')
    /* {{tooltip|HM|Honorable mentions}} → 첫 값 */
    .replace(/\{\{\s*tooltip\s*\|\s*([^|}]+)[^}]*\}\}/gi, '$1')
    /* {{sortname|Martha|Argerich}} → 이름 두 조각을 잇습니다 */
    .replace(/\{\{\s*sortname\s*\|\s*([^|}]+)\|\s*([^|}]+)[^}]*\}\}/gi, '$1 $2')
    /* 나머지 모르는 틀은 지웁니다 */
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/''+/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 나라 이름 — <b>나라인지 아닌지 가리는</b> 데 씁니다
   ★ 퀸 엘리자베스 표에는 「결선 연주곡」 칸이 있어, 그것이 나라 자리로
     들어갔습니다(「David Oistrakh · Tchaikovsky」). 나라 사전이 없으면
     무엇이 나라인지 알 수 없어 이런 일이 생깁니다.
   ★ 여기 없는 나라는 <b>나라가 아닌 것으로</b> 봅니다 — 틀린 나라를
     적는 것보다 비워 두는 편이 낫습니다. */
const COUNTRY = new Set(['USA','USSR','UK','U.S.','U.K.','US','United States','United Kingdom',
  'Soviet Union','Russia','China','Japan','France','Poland','Italy','Germany','West Germany',
  'East Germany','Korea','South Korea','North Korea','Canada','Spain','Israel','Ukraine',
  'Belgium','Netherlands','Austria','Hungary','Bulgaria','Romania','Georgia','Armenia',
  'Latvia','Lithuania','Estonia','Serbia','Croatia','Slovenia','Czech Republic','Czechoslovakia',
  'Slovakia','Turkey','Türkiye','Greece','Sweden','Norway','Finland','Denmark','Iceland',
  'Switzerland','Portugal','Ireland','Brazil','Argentina','Mexico','Chile','Venezuela','Cuba',
  'Colombia','Peru','Uruguay','Australia','New Zealand','Vietnam','Taiwan','Hong Kong',
  'Singapore','India','Iran','Indonesia','Thailand','Philippines','Malaysia','Kazakhstan',
  'KAZ','Uzbekistan','Azerbaijan','Belarus','Moldova','Mongolia','South Africa','Egypt',
  'Yugoslavia','Bosnia and Herzegovina','North Macedonia','Albania','Cyprus','Malta',
  'Luxembourg','Monaco','Puerto Rico','Costa Rica','Ecuador','Bolivia','Paraguay',
].map(x => x.toLowerCase()));

function isCountry(t) {
  const v = String(t || '').trim().toLowerCase();
  if (!v) return false;
  if (COUNTRY.has(v)) return true;
  /* 「Italy Italy」·「Russia Lithuania」·「Argentina / Switzerland」처럼
     둘이 이어진 것도 나라로 봅니다(이중국적·표기 겹침) */
  const parts = v.split(/\s*[\/·]\s*|\s+/).filter(Boolean);
  if (parts.length === 2 && COUNTRY.has(parts[0]) && COUNTRY.has(parts[1])) return true;
  return false;
}

/* 이름 자리에 오면 안 되는 것들
   ★ 상금(€30,000 · 40,000zł)이 이름 칸으로 밀려드는 일이 잦습니다.
     통화 기호가 앞에 오기도 뒤에 오기도 해서 둘 다 봅니다.
   ★ 「not awarded」처럼 <b>주지 않았다</b>는 표시도 이름이 아닙니다. */
function isNotName(c) {
  const t = String(c || '').trim();
  if (!t) return true;
  if (/^[€$£¥]?\s*[\d.,]+\s*(zł|€|\$|£|PLN|EUR|USD|zl)?$/i.test(t)) return true;
  if (/not\s*awarded|nie\s*przyznano|없음|—|–/i.test(t)) return true;
  if (/^(prize|winner|country|total|special|medal|award)s?$/i.test(t)) return true;
  if (/^(1st|2nd|3rd|\d+th|HM|F)$/i.test(t)) return true;
  if (/^\d+\s*px$/i.test(t)) return true;              /* 그림 크기 찌꺼기 */
  if (/^(19|20)\d{2}(\/\d{2,4})?$/.test(t)) return true;  /* 연도 */
  if (t.length < 2 || t.length > 60) return true;
  return false;
}

/* 등수 — 「1st」·「2nd」·「1」·「HM」 */
function rankOf(s) {
  const t = clean(s).toLowerCase();
  if (!t) return '';
  if (/^hm|honou?rable/.test(t)) return 'HM';
  if (/^f\b|finalist/.test(t)) return 'F';
  const m = /^(\d{1,2})(st|nd|rd|th)?$/.exec(t);
  return m ? m[1] : '';
}

/* ── 세 가지 꼴을 시험합니다 ───────────────────────────────── */

/* ① 틀 꼴 — {{…|1st|40,000zł|[[Martha Argerich]]|Argentina}} */
function parseTemplate(wt) {
  const out = [];
  const re = /\{\{[^{}|]*(?:prize|winner)[^{}|]*\|([^{}]*)\}\}/gi;
  let m;
  while ((m = re.exec(wt)) !== null) {
    const cols = m[1].split('|').map(clean);
    if (cols.length < 2) continue;
    /* 「등수 · 상금 · 이름 · 나라」가 흔한 차례입니다.
       상금 칸은 숫자와 통화 기호로 되어 있어 알아볼 수 있습니다. */
    const rank = rankOf(cols[0]);
    const rest = cols.slice(1).filter(c => !isNotName(c));
    if (!rest.length) continue;
    out.push({ rank, name: rest[0], country: rest[1] || '' });
  }
  return out;
}

/* ② 표 꼴 — |- 로 줄을 나누고 | 로 칸을 나눔 */
function parseTable(wt) {
  const out = [];
  const tables = wt.match(/\{\|[\s\S]*?\|\}/g) || [];
  for (const tb of tables) {
    /* 입상자 표인지 — 머리에 Prize·Winner 가 있어야 합니다 */
    if (!/prize|winner|nagrod/i.test(tb.slice(0, 400))) continue;

    /* ★★ <b>특별상 표를 빼야 합니다</b> (2026-08-15 · 시험에서 잡음)
       ─────────────────────────────────────────────────────
       「Best Performance of Mazurkas」 같은 특별상도 같은 꼴의 표입니다.
       그 표에는 등수 칸이 없어, 차례로 매기는 규칙이 <b>1·2·3위를
       특별상 수상자에게 붙여 버립니다.</b>
         제9회 → 짐머만이 <b>1위가 아니라 「마주르카상 1」</b>로 잡혔고,
                 진짜 1~3위 표는 통째로 놓쳤습니다.
       이 하나 때문에 여섯 회가 못 읽혔습니다.
       ▶ 표 안에 「Best Performance」·「Special prize」가 보이면 건너뜁니다. */
    if (/best performance|special prize|audience (award|prize)|nagroda specjalna/i
        .test(tb.slice(0, 600))) continue;
    const rows = tb.split(/\n\|-/).slice(1);
    /* ★ 최근 회차는 1·2·3위 칸에 <b>메달 그림</b>을 넣어 등수 글자가
         아예 없습니다. 대신 <b>나오는 차례가 곧 등수</b>입니다.
         그래서 등수를 못 읽으면 차례로 매깁니다 — 다만 이미 4위·5위가
         읽힌 표에서는 건드리지 않습니다(뒤엉킵니다). */
    let seq = 0;
    for (const row of rows) {
      /* ★ 위키 표는 칸을 <b>두 가지</b>로 나눕니다 —
           줄마다 「| 값」으로 쓰거나, 한 줄에 「| 값 || 값 || 값」으로 잇습니다.
           줄 단위로만 보면 뒤엣것을 통째로 놓칩니다(시험에서 0명이 나왔습니다). */
      const cells = [];
      for (const line of row.split('\n')) {
        if (!/^[|!]/.test(line)) continue;
        const body = line.replace(/^[|!]+\s*/, '');
        for (const c of body.split(/\s*\|\||\s*!!/)) {
          const v = clean(c);
          if (v) cells.push(v);
        }
      }
      if (cells.length < 2) continue;
      let rank = rankOf(cells[0]);
      const rest = cells.slice(1).filter(c => !isNotName(c));
      if (!rest.length) continue;
      /* 첫 칸이 이름이면(등수 칸이 없는 표) 이름 자리를 앞으로 당깁니다 */
      const names = isNotName(cells[0]) ? rest : cells.filter(c => !isNotName(c));
      if (!names.length) continue;
      seq++;
      if (!rank && seq <= 3) rank = String(seq);      /* 차례로 매김 */
      out.push({ rank, name: names[0], country: names[1] || '' });
    }
  }
  return out;
}

/* ③ 줄글 꼴 — 「1st: 5,000zł; Yakov Zak; Soviet Union」 */
function parseLines(wt) {
  const out = [];
  const re = /^\*?\s*(\d{1,2}(?:st|nd|rd|th)?|HM|F)\s*:\s*(.+)$/gim;
  let m;
  while ((m = re.exec(wt)) !== null) {
    const rank = rankOf(m[1]);
    const parts = clean(m[2]).split(';').map(x => x.trim()).filter(Boolean);
    const rest = parts.filter(c => !isNotName(c));
    if (!rest.length) continue;
    out.push({ rank, name: rest[0], country: rest[1] || '' });
  }
  return out;
}

/* ── ④ 연도가 줄이 되는 표 (차이콥스키·퀸 엘리자베스 등) ────
   한 문서에 전 회차가 들어 있고, 줄마다 「연도 | 1위 | 2위 | 3위」 꼴입니다.
       | 1958 | Van Cliburn (USA) | Lev Vlassenko (USSR) Liu Shikun | …
   ★ 칸 하나에 <b>여러 사람</b>이 들어가기도 합니다(공동 수상).
     줄바꿈이나 「<br>」로 나뉘므로 그것으로 가릅니다.
   ★ 나라가 「(USA)」처럼 괄호로 붙습니다 — 떼어 나라 칸에 넣습니다.
   ★ 갈래(피아노·바이올린·첼로)가 표마다 다릅니다. 표 앞의 제목을
     함께 가져와 어느 갈래인지 적어 둡니다. */
function parseYearTable(wt) {
  const out = [];
  const tables = wt.match(/\{\|[\s\S]*?\|\}/g) || [];
  for (const tb of tables) {
    if (/best performance|special prize|jury|juror/i.test(tb.slice(0, 400))) continue;
    /* 머리에 연도·1위 같은 낱말이 있어야 입상자 표입니다 */
    if (!/year|1st|first prize|gold/i.test(tb.slice(0, 500))) continue;

    const rows = tb.split(/\n\|-/).slice(1);
    for (const row of rows) {
      const cells = [];
      for (const line of row.split('\n')) {
        if (!/^[|!]/.test(line)) continue;
        for (const c of line.replace(/^[|!]+\s*/, '').split(/\s*\|\||\s*!!/)) {
          cells.push(clean(c));      /* 빈 칸도 자리를 지켜야 등수가 맞습니다 */
        }
      }
      if (cells.length < 2) continue;

      /* 첫 칸이 연도여야 합니다 */
      const my = /\b(19|20)(\d{2})\b/.exec(cells[0] || '');
      if (!my) continue;
      const year = +(my[1] + my[2]);
      if (year < 1900 || year > 2030) continue;

      /* 나머지 칸이 차례로 1위·2위·3위… */
      for (let i = 1; i < cells.length && i <= 6; i++) {
        const raw = cells[i];
        if (!raw || isNotName(raw)) continue;

        /* ── 한 칸에 여러 사람 ─────────────────────────
           공동 수상이 흔합니다. 한 사람으로 묶이면 <b>사람 수가 틀리고</b>
           나중에 인물DB 와 이을 때 둘 다 못 찾습니다.
               「Vladimir Ashkenazy (USSR) John Ogdon (UK)」  ← 둘
           ★ <b>「(나라)」가 끝나는 자리</b>에서 가릅니다. 그것이 한 사람의
             끝이라는 가장 또렷한 표입니다. */
        let chunk = raw
          .replace(/<\/?[a-z][^>]*>/gi, ' ')     /* </ref> 같은 찌꺼기 */
          .replace(/[}\]]{2,}/g, ' ')
          .trim();

        const people = [];
        const RE_ONE = /([^()]+?)\s*\(([^)]{2,40})\)/g;
        let mo, last = 0, found = false;
        while ((mo = RE_ONE.exec(chunk)) !== null) {
          found = true;
          people.push({ name: mo[1], country: mo[2] });
          last = RE_ONE.lastIndex;
        }
        if (found) {
          const tail = chunk.slice(last).trim();
          if (tail) people.push({ name: tail, country: '' });
        } else {
          /* 괄호가 없으면 두 칸 이상 띄기·가운뎃점으로 가릅니다 */
          chunk.split(/\s{2,}|·|;/).map(x => x.trim()).filter(Boolean)
            .forEach(x => people.push({ name: x, country: '' }));
        }

        for (const one of people) {
          let name = clean(one.name);
          let country = clean(one.country);

          /* 나라가 앞에 붙은 꼴 — 「USA Van Cliburn」·「KAZ Alim Beisembayev」
             ★ 아는 나라일 때만 뗍니다. 사람 이름을 자르면 안 됩니다.
             ★ 나라가 <b>앞뒤로 두 번</b> 오기도 합니다 —
               「{{flag|USSR}} Vladimir Ashkenazy (USSR)」
               깃발 틀이 풀려 앞에 남고 괄호에도 있는 경우입니다.
               그래서 괄호에서 나라를 이미 얻었어도 <b>앞을 한 번 더</b> 봅니다. */
          {
            const w = name.split(/\s+/);
            for (let k = 2; k >= 1; k--) {
              if (w.length > k && isCountry(w.slice(0, k).join(' '))) {
                if (!country) country = w.slice(0, k).join(' ');
                name = w.slice(k).join(' ');
                break;
              }
            }
          }
          /* 「ArgentinaSwitzerland Martha Argerich」처럼 붙어 버린 것 */
          if (!country) {
            const mj = /^([A-Z][a-z]+)([A-Z][a-z]+)\s+(.+)$/.exec(name);
            if (mj && isCountry(mj[1]) && isCountry(mj[2])) {
              country = mj[1] + ' / ' + mj[2];
              name = mj[3];
            }
          }

          /* ★ 나라 자리에 <b>나라가 아닌 것</b>이 오면 비웁니다.
               퀸 엘리자베스 표의 「Tchaikovsky」·「Sibelius」는 연주곡입니다.
               틀린 나라를 적느니 없는 편이 낫습니다. */
          if (country && !isCountry(country)) country = '';

          name = name.replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '');
          if (!name || isNotName(name)) continue;
          if (isCountry(name)) continue;          /* 나라만 남은 칸 */
          out.push({ rank: String(i), name, country, year });
        }
      }
    }
  }
  return out;
}

/* ── ⑤ 문장 꼴 (반 클라이번) ──────────────────────────────
   표가 아니라 <b>줄글 문장</b>에 입상자가 적혀 있습니다 —
       It was won by [[Yunchan Lim]] of [[South Korea]], while
       [[Anna Geniushene]] and [[Dmytro Choni]] were awarded the
       silver and bronze medals respectively.
   ★ 어떻게 읽나 — 문장을 <b>절</b>로 잘라 절마다 봅니다.
     ① 절 안의 메달 낱말(gold·silver·bronze·first prize…)을 차례대로
     ② 절 안의 사람 이름 후보를 차례대로
     ③ 메달이 여럿이면 <b>나온 차례로</b> 짝짓고,
        하나뿐이면 첫 사람에게 줍니다.
     ④ 다만 「shared·jointly」가 보이면 공동 수상이므로 여럿에게 줍니다.
   ★ 「won by」에는 메달 낱말이 없습니다 — 이것은 1위로 봅니다. */
const MEDAL_RANK = {
  gold: '1', silver: '2', bronze: '3',
  first: '1', second: '2', third: '3',
};

/* 사람 이름이 아닌 것 — 기관·장소·대회 이름이 이름 자리에 잘 들어옵니다 */
const NOT_PERSON = /competition|foundation|festival|orchestra|symphon|philharmon|univers|conservator|academy|institute|school|college|award|prize|medal|jury|juror|hall|center|centre|society|committee|records|label|round|final|recital|concerto|sonata|etude|piano|texas|worth|america|amateur|edition|series/i;

function looksPerson(n) {
  const t = String(n || '').trim();
  if (!t || t.length < 4 || t.length > 50) return false;
  if (NOT_PERSON.test(t)) return false;
  if (/^van cliburn$/i.test(t)) return false;     /* 대회 이름의 주인 */
  if (isCountry(t)) return false;
  if (/[\d@#|]/.test(t)) return false;
  const w = t.split(/\s+/);
  if (w.length < 2 || w.length > 4) return false;
  /* 낱말마다 큰 글자로 시작해야 합니다 (of·de·van 같은 이음말은 뺍니다) */
  return w.every(x => /^[A-Z\u00C0-\u024F]/.test(x) || /^(?:de|van|von|der|den|di|da|del|la|le)$/i.test(x));
}

/* 이름 뒤에 붙은 나라 — 「of [[South Korea]]」·「([[Ukraine]])」 */
function countryNear(seg, from) {
  const tail = seg.slice(from, from + 90);
  const cands = [];
  let m;
  const re1 = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  while ((m = re1.exec(tail)) !== null) cands.push(m[1]);
  const re2 = /\(([^)]{2,30})\)/g;
  while ((m = re2.exec(tail)) !== null) cands.push(m[1].replace(/[[\]]/g, ''));
  for (const c of cands) { if (isCountry(c)) return clean(c); }
  return '';
}

/* 절에서 사람 이름 후보를 <b>나온 차례대로</b> */
function nameCandsAt(seg) {
  const out = [];
  const seen = new Set();
  /* ① 링크가 있으면 그것이 가장 또렷합니다 */
  const re = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let m;
  while ((m = re.exec(seg)) !== null) {
    /* 「[[Yunchan Lim (pianist)|Yunchan Lim]]」 → 괄호 설명을 뗍니다 */
    const n = m[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!looksPerson(n) || seen.has(n)) continue;
    seen.add(n);
    out.push({ name: n, country: countryNear(seg, m.index + m[0].length) });
  }
  if (out.length) return out;
  /* ② 링크가 없으면 큰 글자로 이어진 낱말을 봅니다 */
  const flat = clean(seg);
  const re2 = /([A-Z\u00C0-\u024F][\p{L}'’.-]+(?:\s+(?:de|van|von|der|den|di|da|del|la|le)\b)?(?:\s+[A-Z\u00C0-\u024F][\p{L}'’.-]+){1,3})/gu;
  while ((m = re2.exec(flat)) !== null) {
    const n = m[1].trim();
    if (!looksPerson(n) || seen.has(n)) continue;
    seen.add(n);
    out.push({ name: n, country: countryNear(flat, m.index + m[0].length) });
  }
  return out;
}

/* 이름 앞에 붙은 나라를 뗍니다 — 아는 나라일 때만
   ★ 사람 이름을 잘라 내면 안 되므로, 나라 사전에 있는 낱말만 뗍니다.
   ★ 두 나라가 잇달아 붙기도 합니다(이중국적) — 두 낱말까지 봅니다. */
function stripLeadCountry(name) {
  const t = String(name || '').trim();
  const w = t.split(/\s+/);
  for (let k = 2; k >= 1; k--) {
    if (w.length > k + 1 && isCountry(w.slice(0, k).join(' '))) {
      return { name: w.slice(k).join(' '), country: w.slice(0, k).join(' ') };
    }
  }
  return { name: t, country: '' };
}

function parseProse(wt) {
  const out = [];
  /* 참고문헌·심사위원 뒤는 보지 않습니다 — 엉뚱한 이름이 많습니다 */
  const body = wt.split(/\n=+\s*(?:References|External links|Notes|Sources|Bibliography|Further reading|Jury|Jurors|Judges|Repertoire|See also)\b/i)[0]
    /* ★ 표는 <b>통째로 걷어냅니다</b> (2026-08-17 · 시험에서 잡음)
         표 한 줄이 절로 잡히면 상 이름 속 사람이 입상자가 됩니다 —
           「First Prize (Nancy Lee and Perry R. Bass Gold Medal)」
           → 1위 「Nancy Lee」(상을 낸 후원자입니다)
         표는 표 파서가 볼 몫이고, 문장 파서는 <b>줄글만</b> 봅니다. */
    .replace(/\{\|[\s\S]*?\n\|\}/g, '\n');
  /* 다른 대회 이야기가 섞인 문장은 건너뜁니다
     (「그는 차이콥스키 콩쿠르에서 금메달을 땄다」 같은 서술) */
  const OTHER = /tchaikovsky|chopin|leeds|busoni|queen elisabeth|rubinstein|geneva|montreal|hamamatsu|sydney|dublin|honens|naumburg/i;

  /* 절로 자릅니다 — 줄바꿈 · 마침표 · 「, while」·「, with」 */
  /* ★ 콜론에서는 <b>자르지 않습니다</b> — 「* Gold Medal: [[이름]]」이
       등수 쪽과 이름 쪽으로 갈라져 둘 다 못 쓰게 됩니다(시험에서 잡음). */
  const clauses = body.split(/\n+|(?<=[.;])\s+|,\s*(?:while|whilst|with|whereas|although)\s+/);
  for (const seg of clauses) {
    if (!seg || seg.length < 12 || seg.length > 600) continue;
    if (OTHER.test(seg)) continue;

    const ranks = [];
    const reR = /\b(gold|silver|bronze)\b|\b(first|second|third)\s+(?:prize|place)\b/gi;
    let m;
    while ((m = reR.exec(seg)) !== null) {
      const k = (m[1] || m[2]).toLowerCase();
      if (MEDAL_RANK[k]) ranks.push(MEDAL_RANK[k]);
    }
    /* ★ 1위를 가리키는 말은 <b>여러 가지</b>입니다. 메달 낱말이 없는
         문형이 많아 좁게 잡으면 <b>1위만 빠집니다</b> — 2·7·9·10회에서
         2·3위만 읽힌 까닭입니다. */
    const wonBy = /\b(?:won by|shared by|awarded to|went to|winner was|winners? were|first place went|won the (?:competition|contest|gold|first)|took (?:the )?(?:gold|first)|winner of the (?:competition|contest)|was the winner|emerged (?:as )?the winner|top prize)\b/i.test(seg);
    if (!ranks.length && !wonBy) continue;

    const cands = nameCandsAt(seg);
    if (!cands.length) continue;

    const rs = ranks.length ? ranks : ['1'];
    if (rs.length === 1) {
      /* 공동 수상일 때만 여럿 — 아니면 첫 사람만 (엉뚱한 이름 방지) */
      const joint = /\b(shared|jointly|joint|ex aequo|both|tie[ds]?)\b/i.test(seg);
      (joint ? cands.slice(0, 3) : cands.slice(0, 1))
        .forEach(c => out.push({ rank: rs[0], name: c.name, country: c.country }));
    } else {
      for (let i = 0; i < Math.min(rs.length, cands.length); i++) {
        out.push({ rank: rs[i], name: cands[i].name, country: cands[i].country });
      }
    }
  }

  /* ── 다듬기 ────────────────────────────────────────────
     ★ 국기 틀이 풀리면 나라가 <b>이름 앞에</b> 그대로 남습니다 —
         「USA Evren Ozel」·「Israel Russia Vitaly Starikov」
       떼지 않으면 같은 사람이 둘로 갈라져 인물DB 와 이을 때
       <b>둘 다 못 찾습니다.</b> */
  const seen = new Set(), fin = [];
  for (const p of out) {
    const s = stripLeadCountry(p.name);
    const name = s.name;
    const country = p.country || s.country || '';
    if (!name || isNotName(name) || isCountry(name)) continue;
    const k = p.rank + '|' + name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    fin.push({ rank: p.rank, name, country });
  }
  return fin;
}

/* 다섯 가운데 가장 많이 읽어낸 것을 씁니다 */
function parseAll(wt, opt = {}) {
  const tries = [
    { how: '틀', got: parseTemplate(wt) },
    { how: '표', got: parseTable(wt) },
    { how: '줄글', got: parseLines(wt) },
    { how: '연도표', got: parseYearTable(wt) },
  ];
  tries.sort((a, b) => b.got.length - a.got.length);
  let best = tries[0];

  /* ★★ 문장 꼴은 <b>끼워 넣지 않고 따로</b> 봅니다 (2026-08-17)
       ─────────────────────────────────────────────────────
       네 꼴과 나란히 놓고 「많이 읽은 쪽」을 고르게 하면, 이미 잘
       읽고 있는 <b>다섯 대회 1,165건의 결과가 흔들립니다.</b>
       그래서 문장 꼴은 두 자리에서만 씁니다 —
         ① 문장을 먼저 보라고 한 대회 (반 클라이번)
         ② 네 꼴이 <b>한 명도</b> 못 읽었을 때
       이러면 기존 대회의 결과는 한 글자도 바뀌지 않습니다.

     ★★ 문장을 먼저 보는 대회는 <b>표 결과를 아예 쓰지 않습니다</b>
       (2026-08-17 · 첫 실행에서 잡음)
       클라이번 13·14회 표는 상 이름이 이름 자리로 밀려들어
         1위 = 「Prize money」
         1위 = 「First Prize (Nancy Lee and Perry R. Bass Gold Medal) · China …」
       이런 것이 나왔습니다. 이름 40건 가운데 열 건 남짓이 이런 찌꺼기입니다.
       <b>충실도가 개수보다 앞섭니다</b> — 못 읽은 회로 두고 문형을
       더 손보는 편이 낫습니다. */
  if (opt.proseFirst) {
    return finish({ how: '문장', got: parseProse(wt) });
  }
  if (!best.got.length) {
    const prose = parseProse(wt);
    if (prose.length) best = { how: '문장', got: prose };
  }

  /* 이름 같은 것이 두 번 나오면 하나로 */
  return finish(best);
}

/* 읽어낸 것을 마지막으로 다듬습니다 — 두 자리에서 함께 씁니다 */
function finish(best) {
  const seen = new Set(), list = [];
  for (const p of best.got) {
    if (!p.name || p.name.length < 2 || p.name.length > 60) continue;
    if (/^(prize|winner|total|special)$/i.test(p.name)) continue;
    const k = p.rank + '|' + p.name;
    if (seen.has(k)) continue;
    seen.add(k); list.push(p);
  }
  return { how: best.how, list };
}

/* 문서에서 열린 해 읽기 — 「1965」 꼴 */
/* ★ 첫 시험에서 <b>모든 회가 2021</b>로 나왔습니다 — 문서 아래쪽
     각주·참고문헌의 연도를 집은 것입니다.
   ▶ 그래서 <b>대조표를 먼저</b> 씁니다. 회차별 개최 연도는 바뀌지
     않는 사실이고, 문서에서 읽는 것보다 확실합니다.
     문서 값은 대조표에 없는 회차에서만 씁니다. */
function yearOf(wt, no) {
  if (YEARS[no]) return YEARS[no];
  const head = wt.slice(0, 2000);        /* 머리말 안에서만 찾습니다 */
  const m = /was held[^.]*?\b(19|20)(\d{2})\b/i.exec(head);
  if (m) {
    const y = +(m[1] + m[2]);
    if (y >= 1920 && y <= 2030) return y;
  }
  return 0;
}


/* ══ 담기 ═══════════════════════════════════════════════════
   ★ oc_concours_prize 에 담습니다. source_id 로 겹침을 막으므로
     여러 번 돌려도 늘어나지 않고 덮어쓰기만 합니다.
   ★ <b>인물과 잇지 않습니다</b> — person_id 는 비운 채로 둡니다.
     이름만으로 자동으로 합치면 동명이인이 엉킵니다. 잇는 일은
     따로 만든 도구에서 사람이 판단합니다. */
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

/* 등수를 셈하기 좋은 숫자로 — HM·F 는 비웁니다 */
function rankNo(r) {
  const m = /^(\d{1,2})$/.exec(String(r || ''));
  return m ? +m[1] : null;
}

function toRows(comp, list, wikiUrl) {
  const out = [];
  const seen = new Set();
  for (const p of list) {
    if (!p.name || !p.year) continue;
    /* 「대회|연도|등수|이름」이 겹침을 막는 열쇠입니다.
       같은 사람이 같은 해 같은 등수로 두 번 나올 일은 없습니다. */
    const sid = `${comp.key}|${p.year}|${p.rank || '-'}|${p.name}`;
    if (seen.has(sid)) continue;
    seen.add(sid);
    out.push({
      concours: comp.key,
      year: p.year,
      edition: p.edition || null,
      rank: String(p.rank || '-'),
      rank_no: rankNo(p.rank),
      name_en: p.name,
      country: p.country || null,
      field: comp.field || null,
      person_id: null,
      link_status: 'none',
      source: 'wikipedia',
      source_url: wikiUrl || null,
      source_id: sid,
    });
  }
  return out;
}

async function save(rows) {
  let done = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await sb('oc_concours_prize?on_conflict=source_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(part),
    });
    done += part.length;
  }
  return done;
}


/* ══ 실행 ═══════════════════════════════════════════════════ */
(async () => {
  console.log('══ 콩쿠르 입상자 — 될지 봅니다 ══');
  console.log(SAVE ? '   담습니다 (--save)' : '   담지 않습니다 — 세어만 봅니다');
  if (SAVE && (!SB_URL || !SB_KEY)) {
    console.log('   ★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다. 담지 못합니다.');
    process.exit(1);
  }
  console.log('');

  /* 원문 그대로 보기 — --raw=9 (쇼팽 9회) · --raw=tchaikovsky */
  if (RAW) {
    let title;
    /* 「cliburn16」처럼 <b>대회 이름＋회차</b>도 받습니다 —
       회차별 문서를 눈으로 볼 수 있어야 짜임을 고칠 수 있습니다. */
    const mm = /^([a-z-]+?)(\d{1,2})$/.exec(RAW);
    if (/^\d+$/.test(RAW)) title = COMPS[0].title(+RAW);
    else if (mm && COMPS.some(x => x.key === mm[1])) {
      const c = COMPS.find(x => x.key === mm[1]);
      const no = +mm[2];
      title = c.titles ? c.titles(no)[0] : c.title(no);
    } else {
      const c = COMPS.find(x => x.key === RAW);
      if (!c) { console.log('그런 대회가 없습니다 : ' + RAW); return; }
      title = c.title();
    }
    console.log(`── ${title} 원문 ──`);
    try {
      const wt = await raw(title);
      console.log(`길이 ${wt.length} 글자\n`);
      const i = wt.search(/following prizes|won by|gold medal|\{\|[^]*?(prize|year)/i);
      console.log(i >= 0 ? wt.slice(i, i + 3000) : wt.slice(0, 3000));
    } catch (e) {
      console.log('받지 못했습니다 —', e.message);
    }
    return;
  }

  const only = typeof ARGS.only === 'string' ? ARGS.only : null;
  const targets = only ? COMPS.filter(c => c.key === only) : COMPS;
  if (!targets.length) {
    console.log('그런 대회가 없습니다 : ' + only);
    console.log('쓸 수 있는 이름 : ' + COMPS.map(c => c.key).join(' · '));
    return;
  }

  let grandOk = 0, grandFail = 0, grandNames = 0;

  for (const comp of targets) {
    console.log(`── ${comp.nameKo} (${comp.key})`);

    /* ① 회차별 문서 (쇼팽 · 반 클라이번) ─────────────── */
    if (comp.kind === 'per-edition' || comp.kind === 'per-edition-word') {
      const proseFirst = comp.kind === 'per-edition-word';
      let ok = 0, fail = 0, total = 0, saved = 0;
      const bad = [];
      const gotKey = new Set();      /* 「연도|등수」 — 본 문서와 겹침 막기 */
      for (let no = 1; no <= comp.editions; no++) {
        /* ★ 문서 이름 후보를 차례로 두드립니다.
             회마다 이름 짜임이 다를 수 있어, 하나가 없다고 그 회를
             놓치면 안 됩니다. */
        const names = comp.titles ? comp.titles(no) : [comp.title(no)];
        let wt = '', title = names[0], hit = false;
        for (const t0 of names) {
          try {
            const got = await raw(t0);
            await sleep(600);
            /* ★ 「#REDIRECT [[…]]」는 <b>넘겨보내기</b>일 뿐 내용이 없습니다.
                 「1962 Van Cliburn…」처럼 본 문서로 넘겨보내는 이름이
                 흔해서, 이것을 받아들이면 같은 본 문서를 열일곱 번
                 읽고 회차마다 같은 이름이 나옵니다. */
            if (/^\s*#\s*(REDIRECT|넘겨주기)/i.test(got.slice(0, 40))) continue;
            wt = got; title = t0; hit = true; break;
          } catch (e) { await sleep(400); }
        }
        if (!hit) {
          console.log(`   제${String(no).padStart(2)}회  ★ 문서를 받지 못했습니다`
            + (names.length > 1 ? `  (후보 ${names.length}개 모두)` : ''));
          fail++; bad.push(no); continue;
        }
        const year = (comp.years && comp.years[no]) || 0;
        const { how, list } = parseAll(wt, { proseFirst });
        const top3 = ['1', '2', '3'].filter(r => list.some(p => p.rank === r)).length;
        const good = top3 === 3;
        list.forEach(p => { if (year && p.rank) gotKey.add(year + '|' + p.rank); });

        /* ★ 진단 — 못 읽은 회의 <b>원문 문형</b>을 보여 줍니다 (--diag)
             문서마다 문장 짜임이 달라, 어떤 말로 적혀 있는지 보아야
             문형을 더할 수 있습니다. 회차마다 왕복하면 끝이 없어서
             <b>한 번에</b> 모아 봅니다. */
        if (DIAG && !good) {
          console.log(`   ┌── 진단 : ${title}`);
          const head = clean(wt.slice(0, 1200)).slice(0, 320);
          console.log(`   │ 머리말 : ${head}`);
          const lines = wt.split('\n')
            .filter(l => /won|winner|medal|prize|first place/i.test(l))
            .filter(l => !/^\s*(?:\{\{|\[\[(?:File|Image|Category)|<ref)/i.test(l))
            .slice(0, 7);
          lines.forEach(l => console.log(`   │ ${l.replace(/\s+/g, ' ').trim().slice(0, 220)}`));
          if (!lines.length) console.log('   │ (「won·medal·prize」가 든 줄이 없습니다)');
          console.log('   └──');
        }
        if (good) ok++; else { fail++; bad.push(no); }
        total += list.length;
        console.log(`   제${String(no).padStart(2)}회 ${year || '????'}  ${good ? '읽음' : '★못읽음'}`
          + `  입상 ${String(list.length).padStart(2)}명 · 1~3위 ${top3}/3 · 꼴「${how}」`);

        if (SAVE && list.length && year) {
          try {
            const rows = toRows(comp, list.map(p => ({ ...p, year, edition: no })),
              `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`);
            saved += await save(rows);
          } catch (e) {
            console.log(`            ★ 담지 못했습니다 — ${e.message}`);
          }
        }
        if (DUMP && list.length) {
          list.slice(0, 4).forEach(p =>
            console.log(`            ${(p.rank || '-').padStart(3)}  ${p.name}${p.country ? ' · ' + p.country : ''}`));
          if (list.length > 4) console.log(`            … 그리고 ${list.length - 4}명`);
        }
      }
      /* ★ 본 문서도 <b>함께</b> 봅니다 (2026-08-17)
           회차 문서가 없거나 문장이 다른 회를, 본 문서의 연도별 표가
           채워 줍니다. 이미 얻은 「연도|등수」는 건너뛰므로 회차 문서
           쪽이 늘 이깁니다 — 그쪽이 더 자세합니다. */
      if (comp.mainTitle) {
        let mwt = '';
        try { mwt = await raw(comp.mainTitle); await sleep(600); }
        catch (e) { console.log(`   본 문서를 받지 못했습니다 — ${e.message}`); }
        if (mwt) {
          const { how, list } = parseAll(mwt);
          const add = list.filter(p => p.year && p.rank && !gotKey.has(p.year + '|' + p.rank));
          console.log(`   본 문서 「${how}」에서 ${list.length}명 · 새로 더할 것 ${add.length}명`);
          if (DUMP && add.length) {
            add.slice(0, 10).forEach(p =>
              console.log(`            ${p.year}  ${p.rank}위  ${p.name}${p.country ? ' · ' + p.country : ''}`));
            if (add.length > 10) console.log(`            … 그리고 ${add.length - 10}명`);
          }
          total += add.length;
          if (SAVE && add.length) {
            try {
              const rows = toRows(comp, add,
                `https://en.wikipedia.org/wiki/${encodeURIComponent(comp.mainTitle)}`);
              saved += await save(rows);
            } catch (e) { console.log(`   ★ 본 문서분을 담지 못했습니다 — ${e.message}`); }
          }
        }
      }

      console.log(`   ▶ ${comp.editions}회 가운데 ${ok}회 읽음 · 입상자 ${total}명`);
      if (bad.length) console.log(`     못 읽은 회 : ${bad.join(' · ')}`);
      if (SAVE) console.log(`     담음 : ${saved}건`);
      grandOk += ok; grandFail += fail; grandNames += total;
      console.log('');
      continue;
    }

    /* ② 한 문서에 전 회차 ────────────────────────────── */
    let wt = '';
    try { wt = await raw(comp.title()); }
    catch (e) {
      console.log(`   ★ 문서를 받지 못했습니다 — ${e.message}`);
      grandFail++; console.log(''); continue;
    }
    await sleep(600);

    const { how, list } = parseAll(wt);
    if (!list.length) {
      console.log('   ★★ 한 명도 읽지 못했습니다 — --raw=' + comp.key + ' 로 원문을 보십시오');
      grandFail++; console.log(''); continue;
    }

    /* 연도별로 몇 명씩인지 */
    const byYear = {};
    list.forEach(p => { const y = p.year || 0; byYear[y] = (byYear[y] || 0) + 1; });
    const years = Object.keys(byYear).filter(y => +y > 0).sort();
    console.log(`   입상자 ${list.length}명 · 꼴「${how}」`);
    if (years.length) {
      console.log(`   회차 ${years.length}개 (${years[0]} ~ ${years[years.length - 1]})`);
    } else {
      console.log('   ★ 연도를 읽지 못했습니다 — 담을 때 문제가 됩니다');
    }
    /* 1위가 몇 회분 있는지 — 이것이 「제대로 읽었나」의 기준 */
    const firsts = new Set(list.filter(p => p.rank === '1' && p.year).map(p => p.year));
    console.log(`   1위를 읽은 회차 : ${firsts.size}개`);

    if (DUMP) {
      const show = list.filter(p => p.rank === '1').slice(0, 8);
      show.forEach(p => console.log(`      ${p.year || '????'}  1위  ${p.name}${p.country ? ' · ' + p.country : ''}`));
      if (list.filter(p => p.rank === '1').length > 8)
        console.log(`      … 그리고 ${list.filter(p => p.rank === '1').length - 8}회`);
    }

    if (SAVE) {
      /* ★ 한 대회가 담기에 실패해도 <b>나머지는 이어 갑니다.</b>
           예전에는 실행이 통째로 멈춰, 뒤쪽 대회가 담기지 않았습니다. */
      try {
        const rows = toRows(comp, list, `https://en.wikipedia.org/wiki/${encodeURIComponent(comp.title())}`);
        const n = await save(rows);
        console.log(`   담음 : ${n}건`);
      } catch (e) {
        console.log(`   ★ 담지 못했습니다 — ${e.message}`);
        grandFail++;
      }
    }

    if (firsts.size >= 5) grandOk++; else grandFail++;
    grandNames += list.length;
    console.log('');
  }

  console.log(`=== 잘 읽은 것 ${grandOk} · 못 읽은 것 ${grandFail} · 이름 모두 ${grandNames}명 ===`);
})().catch(e => { console.error('■ 실패:', e); process.exit(1); });
