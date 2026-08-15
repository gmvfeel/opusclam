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
const RAW = ARGS.raw ? String(ARGS.raw) : null;

const UA = 'OpusclamBot/1.0 (+https://opusclam.com; classical music database)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 쇼팽 콩쿠르는 로마 숫자로 문서 이름을 씁니다 */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX'];

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
    title: () => 'International Tchaikovsky Competition',
  },
  {
    key: 'queen-elisabeth', kind: 'one-page',
    nameKo: '퀸 엘리자베스 콩쿠르',
    nameEn: 'Queen Elisabeth Competition',
    title: () => 'Queen Elisabeth Competition',
  },
  {
    key: 'cliburn', kind: 'one-page',
    nameKo: '반 클라이번 국제 피아노 콩쿠르',
    nameEn: 'Van Cliburn International Piano Competition',
    title: () => 'Van Cliburn International Piano Competition',
  },
  {
    key: 'leeds', kind: 'one-page',
    nameKo: '리즈 국제 피아노 콩쿠르',
    nameEn: 'Leeds International Piano Competition',
    title: () => 'Leeds International Piano Competition',
  },
  {
    key: 'busoni', kind: 'one-page',
    nameKo: '부조니 국제 피아노 콩쿠르',
    nameEn: 'Ferruccio Busoni International Piano Competition',
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
        /* 한 칸에 여러 사람 — 「이름 (나라) 이름2 (나라2)」 */
        const people = raw.split(/\s{2,}|·|;|\n/).map(x => x.trim()).filter(Boolean);
        for (const one of people) {
          /* 나라가 이름에 붙는 꼴이 <b>두 가지</b>입니다 —
               「Van Cliburn (USA)」   괄호로 뒤에
               「USA Van Cliburn」     깃발 틀이 풀려 앞에
             ★ 뒤엣것을 안 떼면 이름이 「USA Van Cliburn」이 되어
               인물DB와 이어 붙일 수 없습니다. */
          let name = '', country = '';
          const mp = /^(.+?)\s*\(([^)]{2,30})\)\s*$/.exec(one);
          if (mp) { name = clean(mp[1]); country = clean(mp[2]); }
          else {
            /* 앞에 붙은 나라 — 깃발 틀이 풀린 자리입니다.
               아는 나라 이름일 때만 뗍니다(사람 이름을 자르면 안 됩니다). */
            const mf = /^(USA|USSR|UK|China|Japan|Russia|France|Poland|Italy|Germany|Korea|South Korea|Canada|Spain|Israel|Ukraine|Belgium|Netherlands|Austria|Hungary|Bulgaria|Romania|Georgia|Armenia|Latvia|Lithuania|Estonia|Serbia|Croatia|Slovenia|Czech Republic|Slovakia|Turkey|Greece|Sweden|Norway|Finland|Denmark|Switzerland|Portugal|Brazil|Argentina|Mexico|Australia|New Zealand|Vietnam|Taiwan|Hong Kong|Singapore|India|United States|United Kingdom|Soviet Union)\s+(.+)$/i.exec(one);
            if (mf) { country = clean(mf[1]); name = clean(mf[2]); }
            else name = clean(one);
          }
          if (!name || isNotName(name)) continue;
          out.push({ rank: String(i), name, country, year });
        }
      }
    }
  }
  return out;
}

/* 셋 가운데 가장 많이 읽어낸 것을 씁니다 */
function parseAll(wt) {
  const tries = [
    { how: '틀', got: parseTemplate(wt) },
    { how: '표', got: parseTable(wt) },
    { how: '줄글', got: parseLines(wt) },
    { how: '연도표', got: parseYearTable(wt) },
  ];
  tries.sort((a, b) => b.got.length - a.got.length);
  const best = tries[0];

  /* 이름 같은 것이 두 번 나오면 하나로 */
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


/* ══ 실행 ═══════════════════════════════════════════════════ */
(async () => {
  console.log('══ 콩쿠르 입상자 — 될지 봅니다 ══');
  console.log('   담지 않습니다. 몇 회를 읽어낼 수 있는지만 셉니다.');
  console.log('');

  /* 원문 그대로 보기 — --raw=9 (쇼팽 9회) · --raw=tchaikovsky */
  if (RAW) {
    let title;
    if (/^\d+$/.test(RAW)) title = COMPS[0].title(+RAW);
    else {
      const c = COMPS.find(x => x.key === RAW);
      if (!c) { console.log('그런 대회가 없습니다 : ' + RAW); return; }
      title = c.title();
    }
    console.log(`── ${title} 원문 ──`);
    try {
      const wt = await raw(title);
      console.log(`길이 ${wt.length} 글자\n`);
      const i = wt.search(/following prizes|\{\|[^]*?(prize|year)/i);
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

    /* ① 회차별 문서 (쇼팽) ─────────────────────────── */
    if (comp.kind === 'per-edition') {
      let ok = 0, fail = 0, total = 0;
      const bad = [];
      for (let no = 1; no <= comp.editions; no++) {
        const title = comp.title(no);
        let wt = '';
        try { wt = await raw(title); }
        catch (e) {
          console.log(`   제${String(no).padStart(2)}회  ★ 문서를 받지 못했습니다`);
          fail++; bad.push(no); await sleep(600); continue;
        }
        await sleep(600);
        const year = comp.years[no] || 0;
        const { how, list } = parseAll(wt);
        const top3 = ['1', '2', '3'].filter(r => list.some(p => p.rank === r)).length;
        const good = top3 === 3;
        if (good) ok++; else { fail++; bad.push(no); }
        total += list.length;
        console.log(`   제${String(no).padStart(2)}회 ${year || '????'}  ${good ? '읽음' : '★못읽음'}`
          + `  입상 ${String(list.length).padStart(2)}명 · 1~3위 ${top3}/3 · 꼴「${how}」`);
        if (DUMP && list.length) {
          list.slice(0, 4).forEach(p =>
            console.log(`            ${(p.rank || '-').padStart(3)}  ${p.name}${p.country ? ' · ' + p.country : ''}`));
          if (list.length > 4) console.log(`            … 그리고 ${list.length - 4}명`);
        }
      }
      console.log(`   ▶ ${comp.editions}회 가운데 ${ok}회 읽음 · 입상자 ${total}명`);
      if (bad.length) console.log(`     못 읽은 회 : ${bad.join(' · ')}`);
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

    if (firsts.size >= 5) grandOk++; else grandFail++;
    grandNames += list.length;
    console.log('');
  }

  console.log(`=== 잘 읽은 것 ${grandOk} · 못 읽은 것 ${grandFail} · 이름 모두 ${grandNames}명 ===`);
})().catch(e => { console.error('■ 실패:', e); process.exit(1); });
