/* ============================================================
   OPUSCLAM 한국 작곡가 보강 — seed/kr-composer.mjs

   무엇을 하나
    · 정해진 명단의 한국 클래식 작곡가를 한국어 위키백과에서 찾아
      인물DB(persons)에 담습니다

   왜 명단으로 하나
    처음에는 「대한민국의 작곡가」 분류를 훑었습니다. 그런데 그 분류에는
    1,146명이 있고 대부분 대중음악 쪽이었습니다.
    249명을 골라 봤더니 클래식 작곡가는 스무 명쯤이고
    나머지는 가수·랩퍼·배우·연주자였습니다.

      DJ 클래지 · 기리보이 · 성시경 · 임창정 · 구혜선 · 노부스 콰르텟 …

    걸러내기를 조여도 엉뚱한 사람이 섞일 위험이 남습니다.
    그래서 <b>명단을 정해 그 이름만 찾습니다.</b> 수는 적지만 틀림이 없습니다.

   지어내지 않습니다
    명단에는 <b>이름만</b> 적습니다. 생몰년·학력·설명은 모두 위키백과에서
    받습니다. 위키백과에 없는 분은 담지 않고 로그로 알려 드립니다 —
    그러면 다른 자료로 채우실지 판단하실 수 있습니다.

   명단을 늘리려면
    아래 KR_COMPOSERS 에 이름을 한 줄 더하시면 됩니다.

   출처
    한국어 위키백과 · CC BY-SA. 각 항목에 링크를 적어 둡니다.

   쓰는 법
     node seed/kr-composer.mjs --dry           담지 않고 누가 들어올지 보기
     node seed/kr-composer.mjs                 실제로 담기
     node seed/kr-composer.mjs --dry --debug   찾는 과정을 자세히

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

const WP = 'https://ko.wikipedia.org/w/api.php';
const UA = 'OpusclamKrComposerBot/1.0 (https://opusclam.com)';

/* ============================================================
   한국 클래식 작곡가 명단

   세대별로 묶었습니다. 이름만 적고 나머지는 위키백과에서 받습니다.
   국악 작곡가도 함께 담습니다 — 오퍼스클램은 국악을 함께 다룹니다.

   ★ 늘리시려면 알맞은 자리에 이름을 한 줄 더하시면 됩니다.
   ============================================================ */
const KR_COMPOSERS = [
  /* ── 근대 (개화기~일제강점기에 활동) ── */
  '홍난파', '현제명', '채동선', '안익태', '박태준', '김세형',
  '이흥렬', '조두남', '김성태', '김동진', '윤용하', '나운영',
  '김순남', '정율성', '금수현', '임원식',

  /* ── 현대 1세대 (1920~1940년대 태어남) ── */
  '윤이상', '정추', '이상근', '정회갑', '김희조', '변훈',
  '강석희', '백병동', '나인용', '김정길', '이영조', '강준일',
  '박영희', '이건용', '박준상', '이성천', '박범훈', '백대웅',

  /* ── 현대 2세대 (1950~1960년대 태어남) ── */
  '황성호', '정태봉', '이돈응', '김영동', '이신우', '임준희',
  '진은숙', '신동일', '김대성', '최우정', '류재준',

  /* ── 현대 3세대 (1970년대 이후 태어남) ── */
  '김택수', '조은화', '신동훈', '우효원',

  /* ── 우리 영상 자료에 작품이 나온 분들 ── */
  '김신', '강경묵', '신동선',
];

/* 이 사람이 작곡가인지 가려낼 말 — 소개글에 하나라도 있어야 담습니다 */
/* 이 사람이 작곡가인지 가려낼 말 — 소개글에 하나라도 있어야 담습니다.
   처음에는 「작곡가」 라는 말만 찾았는데, 위키백과 소개글이
   「음악대학 교수」「작곡 전공」「관현악 작품을 발표」 처럼 시작하는 분들이
   걸러졌습니다(최우정·임준희·이영조·박영희 등). 그래서 넓혔습니다. */
const OK_WORDS = /(작곡가|작곡을|작곡 활동|작곡 전공|작곡과|작곡법|음악가|교향곡|관현악|실내악|오페라|칸타타|가곡|협주곡|국악 작곡|현대음악)/;

/* 이 말이 있으면 담지 않습니다 — 같은 이름의 다른 사람일 수 있습니다 */
const NG_WORDS = /(가수이자|랩퍼|래퍼|아이돌|배우이자|배우로|정치인|축구|야구|기업인|의사|변호사|고려|조선 전기|조선 중기|조선 후기|문신|장군|승려|왕자|국왕)/;

/* 「작곡가로 보이는 정도」 를 셈합니다 — 높을수록 작곡가일 가능성이 큽니다 */
function scoreComposer(ex, title) {
  const head = String(ex || '').slice(0, 220);
  let n = 0;
  if (/작곡가/.test(head)) n += 5;
  if (/작곡가/.test(String(title || ''))) n += 4;
  if (/(작곡을|작곡 활동|작곡 전공|작곡과)/.test(head)) n += 3;
  if (/(교향곡|관현악|실내악|오페라|칸타타|협주곡|현대음악)/.test(ex)) n += 2;
  if (/(가곡|합창|국악 작곡)/.test(ex)) n += 2;
  if (/(음악대학|음악원|예술종합학교|음대)/.test(ex)) n += 1;
  if (/음악가/.test(head)) n += 1;
  /* 작곡과 관계없는 쪽이면 깎습니다 */
  if (/(지휘자|피아니스트|바이올리니스트|성악가|소프라노|테너)/.test(head) && !/작곡/.test(head)) n -= 3;
  return n;
}

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

async function wp(params) {
  const q = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(`${WP}?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`위키백과 HTTP ${res.status}`);
  return await res.json();
}

/* ============================================================
   위키백과에서 한 사람을 찾습니다

   「이름」 으로 먼저 찾고, 그 문서가 작곡가가 아니면
   「이름 (작곡가)」 를 봅니다. 그래도 없으면 검색을 씁니다.
   ============================================================ */
async function findPerson(name) {
  const tried = [];

  const titles = [name, name + ' (작곡가)', name + ' (음악가)'];
  let data;
  try {
    data = await wp({
      action: 'query', prop: 'extracts|pageprops',
      titles: titles.join('|'),
      exintro: '1', explaintext: '1', redirects: '1',
    });
  } catch (e) {
    return { name: name, found: false, why: '위키백과를 읽지 못했습니다' };
  }

  /* 문서가 여럿이면 「작곡가로 보이는 정도」 를 점수로 매겨 가장 나은 것을 고릅니다.
     예전에는 처음 만난 문서만 보고 판단해, 동명이인 문서가 먼저 잡히면
     확실한 작곡가도 걸러졌습니다(이영조·최우정·임준희 등). */
  const pages = Object.values((data.query && data.query.pages) || {});
  const cands = [];
  for (const p of pages) {
    if (!p.title || p.missing !== undefined) continue;
    const ex = String(p.extract || '').replace(/\s+/g, ' ').trim();
    tried.push(p.title);
    if (!ex) continue;
    if (NG_WORDS.test(ex.slice(0, 160))) continue;   /* 같은 이름의 다른 사람 */
    cands.push({ page: p, ex: ex, score: scoreComposer(ex, p.title) });
  }
  if (cands.length) {
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0];
    if (best.score > 0) {
      return {
        name: name, found: true, title: best.page.title, extract: best.ex,
        qid: (best.page.pageprops && best.page.pageprops.wikibase_item) || null,
      };
    }
  }

  /* 검색으로 한 번 더 — 「이름 작곡가」 로 찾습니다 */
  try {
    const sr = await wp({
      action: 'query', list: 'search',
      srsearch: name + ' 작곡가', srlimit: '5',
    });
    const hits = (sr.query && sr.query.search) || [];
    for (const h of hits) {
      const bare = String(h.title).replace(/\s*\([^)]*\)\s*$/, '');
      if (bare !== name) continue;
      const d2 = await wp({
        action: 'query', prop: 'extracts|pageprops',
        titles: h.title, exintro: '1', explaintext: '1', redirects: '1',
      });
      const p2 = Object.values((d2.query && d2.query.pages) || {})[0];
      if (!p2 || p2.missing !== undefined) continue;
      const ex2 = String(p2.extract || '').replace(/\s+/g, ' ').trim();
      tried.push(p2.title);
      if (!ex2 || NG_WORDS.test(ex2.slice(0, 160)) || !OK_WORDS.test(ex2)) continue;
      return {
        name: name, found: true, title: p2.title, extract: ex2,
        qid: (p2.pageprops && p2.pageprops.wikibase_item) || null,
      };
    }
  } catch (e) { /* 검색이 안 되면 넘어갑니다 */ }

  /* ★ 마지막으로 <b>위키데이터</b>에 물어봅니다.
     한국어 위키에 문서가 없거나 동명이인에 묻힌 사람을 여기서 건집니다.
     (신동훈처럼 영문 위키·위키데이터에만 있는 경우 — 2026-08-10) */
  try {
    const wd = await wdFindPerson(name);
    if (wd) {
      return {
        name: name, found: true, title: wd.label,
        extract: wd.desc || '',      /* 소개글이 짧습니다 — enrich 가 뒤에 채웁니다 */
        qid: wd.qid,
        via: '위키데이터',
        wdBorn: wd.born,        /* ★ 검색할 때 이미 받았습니다 — 다시 물을 필요 없습니다 */
      };
    }
  } catch (e) { /* 위키데이터가 안 되면 아래로 */ }
  return {
    name: name, found: false,
    why: tried.length ? `문서는 있으나 작곡가로 보이지 않습니다 (${tried.join(', ')})`
                      : '위키백과에 문서가 없습니다',
  };
}

/* ============================================================
   위키데이터에서 생몰년을 받습니다 — 여기가 가장 정확합니다

   왜 소개글을 읽지 않는가
     문장 모양에 따라 계속 어긋났습니다.
       「백병동(1936년 ~ )은 … 2026년 현재 …」  →  1936–2026 으로 잘못 읽음
       괄호 안만 보게 조이니 이번엔 김성태의 생몰년을 놓쳤습니다.

     위키데이터에는 생몰일이 <b>숫자 칸</b>(P569 태어남 · P570 죽음)으로
     들어 있어 헷갈릴 일이 없습니다. 그쪽을 먼저 씁니다.
     위키데이터에 없을 때만 소개글을 봅니다.
   ============================================================ */
const WD = 'https://www.wikidata.org/w/api.php';

/* ── 위키데이터에서 이름으로 찾습니다 ─────────────────────────────
   ★★ 왜 필요한가 (2026-08-10 · 파트너가 빠진 20명을 물어봐 알게 됨) ★★
     이 수집기는 <b>한국어 위키백과만</b> 보았습니다.
     그런데 해외에서 활동하는 한국 작곡가는 <b>영문 위키·위키데이터에만</b>
     문서가 있는 일이 흔합니다.
       · 신동훈(1983~) — 베를린 필하모닉 재단·LA 필하모닉이 위촉하는
         작곡가인데 영문 위키와 위키데이터(Q137783742)에만 있어서
         이 수집기가 <b>「위키백과에 문서가 없습니다」</b> 라고 했습니다.
     ▶ 한국어 위키에서 못 찾으면 <b>위키데이터에 한 번 더</b> 물어봅니다.
       위키데이터는 언어를 가리지 않고, 「직업」 이 항목으로 들어 있어
       작곡가인지 아닌지도 확실히 가릴 수 있습니다.

   ★ 어떻게 가리는가
     ① 이름으로 검색 (한국어 · 영어 둘 다)
     ② 사람(Q5)인지 확인 — 곡 이름·단체가 걸리는 것을 막습니다
     ③ 직업(P106)에 작곡가(Q36834)가 있는지 확인
     ④ 한국어 라벨이 있으면 이름이 실제로 맞는지 대조
     ⑤ 태어난 해가 1850년 이후인지 — 같은 이름의 옛 인물을 걸러냅니다
   ★ 못 찾으면 조용히 null 을 돌려줍니다. 수집기를 멈추지 않습니다. */
const WD_COMPOSER = 'Q36834';    /* 작곡가 */
const WD_HUMAN    = 'Q5';        /* 사람 */

async function wdFindPerson(name) {
  /* ① 이름으로 검색 — 한국어로 먼저, 그다음 영어 */
  const ids = [];
  for (const lang of ['ko', 'en']) {
    try {
      const q = new URLSearchParams({
        action: 'wbsearchentities', search: name, language: lang,
        uselang: lang, type: 'item', limit: '8', format: 'json', origin: '*',
      });
      const res = await fetch(WD + '?' + q, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const data = await res.json();
        for (const it of ((data && data.search) || [])) {
          if (it && it.id && ids.indexOf(it.id) < 0) ids.push(it.id);
        }
      }
    } catch (e) { /* 한 언어가 안 되면 다른 언어로 */ }
    await new Promise((r) => setTimeout(r, 180));
    if (ids.length >= 8) break;
  }
  if (!ids.length) return null;

  /* ② 후보들의 속내를 봅니다 — 사람인가 · 작곡가인가 */
  let ents;
  try {
    const q = new URLSearchParams({
      action: 'wbgetentities', ids: ids.slice(0, 12).join('|'),
      props: 'claims|labels|descriptions', languages: 'ko|en',
      format: 'json', origin: '*',
    });
    const res = await fetch(WD + '?' + q, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    ents = (data && data.entities) || {};
  } catch (e) { return null; }

  const idOf = (snak) => {
    const v = snak && snak.mainsnak && snak.mainsnak.datavalue
           && snak.mainsnak.datavalue.value;
    return (v && v.id) || null;
  };

  for (const qid of ids) {
    const e = ents[qid];
    if (!e || !e.claims) continue;
    const cl = e.claims;

    /* 사람이어야 합니다 — 곡 이름·단체가 걸리는 것을 막습니다 */
    const kinds = (cl.P31 || []).map(idOf).filter(Boolean);
    if (kinds.length && kinds.indexOf(WD_HUMAN) < 0) continue;

    /* 직업에 작곡가가 있어야 합니다 */
    const jobs = (cl.P106 || []).map(idOf).filter(Boolean);
    if (jobs.indexOf(WD_COMPOSER) < 0) continue;

    /* 한국어 라벨이 있으면 이름이 실제로 맞는지 봅니다 */
    const koLabel = (e.labels && e.labels.ko && e.labels.ko.value) || '';
    if (koLabel) {
      const bare = koLabel.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (bare !== name) continue;      /* 라벨이 있는데 다르면 딴 사람 */
    }

    /* 태어난 해 — 같은 이름의 옛 인물을 걸러냅니다 */
    let born = null;
    const b = (cl.P569 || [])[0];
    const t = b && b.mainsnak && b.mainsnak.datavalue
           && b.mainsnak.datavalue.value && b.mainsnak.datavalue.value.time;
    if (t) {
      const m = String(t).match(/([+-])(\d{4})/);
      if (m && m[1] === '+') born = Number(m[2]);
    }
    if (born && born < 1850) continue;

    const desc = (e.descriptions && (e.descriptions.ko || e.descriptions.en));
    return {
      qid: qid,
      born: born,
      label: koLabel || name,
      desc: (desc && desc.value) || '',
    };
  }
  return null;
}

async function wdLife(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += 40) {
    const part = qids.slice(i, i + 40);
    try {
      const q = new URLSearchParams({
        action: 'wbgetentities', ids: part.join('|'),
        props: 'claims', format: 'json', origin: '*',
      });
      const res = await fetch(`${WD}?${q}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const ents = (data && data.entities) || {};
      for (const id of Object.keys(ents)) {
        const cl = (ents[id] && ents[id].claims) || {};
        const year = (prop) => {
          const arr = cl[prop];
          if (!arr || !arr.length) return null;
          const t = arr[0].mainsnak && arr[0].mainsnak.datavalue
                 && arr[0].mainsnak.datavalue.value
                 && arr[0].mainsnak.datavalue.value.time;
          if (!t) return null;
          const m = String(t).match(/([+-])(\d{4})/);
          if (!m || m[1] === '-') return null;      /* 기원전은 사람이 아닙니다 */
          const y = Number(m[2]);
          return (y >= 1700 && y <= new Date().getFullYear()) ? y : null;
        };
        const born = year('P569'), died = year('P570');
        if (born || died) out[id] = { born: born, died: died };
      }
    } catch (e) { /* 못 받으면 소개글로 갑니다 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

/* ============================================================
   소개글에서 정보를 캐냅니다 — 위키데이터에 없을 때만 씁니다
   ============================================================ */
function pickLife(text) {
  const t = String(text || '');
  const NOW = new Date().getFullYear();

  /* 소개글 첫머리의 괄호 안을 먼저 봅니다 — 여기가 가장 믿을 만합니다.
       홍난파(洪蘭坡, 1898년 4월 10일 ~ 1941년 8월 30일)는 …
       이건용(1947년 ~ )은 …
     괄호 밖까지 훑으면 「2026년 현재」 같은 말을 사망년으로 잘못 읽습니다.
     실제로 「백병동 1936 – 2026」「최영섭 1929 – 2026」 처럼 잡힌 일이 있었습니다. */
  const head = t.slice(0, 260);
  const paren = head.match(/\(([^)]{4,90})\)/);
  const zone = paren ? paren[1] : head;

  const ok = (y) => y >= 1800 && y <= NOW;      /* 사람의 생몰년으로 볼 수 있는 범위 */

  /* 「1898년 … ~ 1941년」 */
  let m = zone.match(/(\d{4})\s*년[^~–-]{0,26}[~–-]\s*(\d{4})\s*년/);
  if (m && ok(+m[1]) && ok(+m[2]) && +m[2] > +m[1]) {
    return { born: +m[1], died: +m[2], life: `${m[1]} – ${m[2]}` };
  }
  /* 「1947년 ~ 」 — 살아 계신 분 */
  m = zone.match(/(\d{4})\s*년[^~–-]{0,26}[~–-]\s*\)?\s*$/)
   || zone.match(/(\d{4})\s*년\s*[~–-]/);
  if (m && ok(+m[1])) return { born: +m[1], died: null, life: `${m[1]}~` };
  /* 「1959년생」 */
  m = zone.match(/(\d{4})\s*년\s*생/);
  if (m && ok(+m[1])) return { born: +m[1], died: null, life: `${m[1]}~` };

  /* 괄호에서 못 찾으면 첫머리에서 「태어났다」 를 봅니다 */
  m = head.match(/(\d{4})\s*년[^.]{0,24}?(출생|태어)/);
  if (m && ok(+m[1])) return { born: +m[1], died: null, life: `${m[1]}~` };

  return { born: null, died: null, life: null };
}

function pickSchool(text) {
  const t = String(text || '');
  const m = t.match(/([가-힣A-Za-z·]{2,20}(대학교|대학|음악원|예술종합학교|콘서바토리|음악대학))/);
  return m ? m[1] : null;
}

function pickEra(born) {
  if (!born) return null;
  if (born >= 1945) return '현대';
  if (born >= 1900) return '근·현대';
  return '근대';
}

/* 국악 쪽인지 봅니다 — 분야를 갈라 두면 나중에 가려 보기 좋습니다 */
function pickField(text) {
  /* 첫머리(소개 문장)만 봅니다.
     본문 어딘가에 「국악」 이 한 번 나온 것으로 국악 작곡가라 하면
     서양 현대음악 작곡가가 국악으로 잡힙니다(강석희가 그랬습니다). */
  const t = String(text || '').slice(0, 200);
  if (/(국악|판소리|창극|정악|민속악|가야금|거문고|대금|해금|한국음악)\s*(작곡|작품|계|을|를|에)/.test(t)
      || /국악\s*(작곡가|작곡)/.test(t)) return '작곡·국악';
  return '작곡';
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 한국 작곡가 보강 (명단으로) ──');
  console.log(`명단 ${KR_COMPOSERS.length}명${DRY ? ' · 담지 않음(dry)' : ''}\n`);

  /* 이미 담긴 사람 — 한글만 남겨 견줍니다 */
  /* ── 나눠 받기 ────────────────────────────────────────────
     Supabase 에 「한 번에 받을 수 있는 양」 제한이 걸려 있습니다(200개).
     예전에는 1000개씩 달라 하고 「받은 것이 1000보다 적으면 끝」 으로 봤는데,
     200개만 오니 첫 묶음에서 멈춰 <b>앞쪽 200명만 알고</b> 나머지 8,900명을
     모른 채 「없는 사람」 이라 판단했습니다.
     그래서 150개씩 달라 하고, <b>아무것도 오지 않을 때까지</b> 받습니다.
     ────────────────────────────────────────────────────── */
  const have = [];
  const STEP = 150;
  for (let off = 0; off < 60000; off += STEP) {
    const part = await sb(`persons?select=id,name_ko,wikidata_id&order=id&limit=${STEP}&offset=${off}`);
    if (!part || !part.length) break;
    have.push(...part);
  }
  const onlyKo = (v) => String(v || '').replace(/[^가-힣]/g, '');
  const haveSet = new Set(have.map((h) => onlyKo(h.name_ko)).filter(Boolean));
  /* 위키데이터 번호는 겹치면 안 되는 규칙이 걸려 있습니다.
     이미 있는 번호를 그대로 담으면 저장이 통째로 거부됩니다 —
     실제로 한 사람 때문에 스물일곱 명이 모두 실패한 일이 있었습니다. */
  const haveQid = new Set(have.map((h) => h.wikidata_id).filter(Boolean));
  console.log(`인물DB 에 이미 있는 사람 : ${have.length}명`);
  console.log(`  그 가운데 위키데이터 번호가 있는 사람 : ${haveQid.size}명`);

  /* ── 다시 담지 않을 사람 ──────────────────────────────────
     한 번 지운 사람이 수집기를 돌릴 때마다 되살아나면 안 됩니다.
     person_block 표에 적힌 사람은 건너뜁니다.
     (표가 아직 없으면 그냥 넘어갑니다) */
  const blockName = new Set(), blockQid = new Set();
  try {
    for (let off = 0; off < 20000; off += 150) {
      const part = await sb(`person_block?select=name_ko,wikidata_id&order=id&limit=150&offset=${off}`);
      if (!part || !part.length) break;
      for (const b of part) {
        if (b.name_ko) blockName.add(onlyKo(b.name_ko) || b.name_ko);
        if (b.wikidata_id) blockQid.add(b.wikidata_id);
      }
    }
    if (blockName.size || blockQid.size) {
      console.log(`  person_block 에서 : ${blockName.size}명 · 번호 ${blockQid.size}개`);
    }
  } catch (e) {
    console.log('  (person_block 을 읽지 못했습니다 — 표가 아직 없을 수 있습니다)');
  }

  /* ★ blocklist 도 함께 읽습니다.

     왜 필요한가 (2026-08-03 확인)
       차단 목록을 담는 표가 <b>둘</b>이었습니다.
         blocklist     어드민의 「삭제 + 차단」 이 남기는 곳.
                       수집기 여섯 개가 이것을 읽습니다.
         person_block  이 파일 하나만 읽던 곳.
       그래서 어드민에서 지운 인물이 <b>이 수집기를 돌릴 때 되돌아왔습니다.</b>
       실제로 blocklist 201개 가운데 195개가 person_block 에 없었습니다.

     둘을 다 읽으면 어느 쪽에 적혀 있어도 걸러집니다.
     (표를 합치는 것보다 안전합니다 — 기존 흐름을 건드리지 않습니다) */
  try {
    let bfrom = 0;
    let added = 0;
    for (;;) {
      /* ★ 정렬을 붙입니다. 정렬이 없으면 페이지마다 순서가 흔들려
         목록의 일부를 놓칩니다. 놓친 번호는 걸러지지 않으므로
         그 인물이 다시 들어옵니다 — 실제로 그 일이 났습니다. */
      const res = await fetch(
        `${SB_URL}/rest/v1/blocklist?select=wikidata_id&order=wikidata_id.asc`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
                     Range: `${bfrom}-${bfrom + 999}` } });
      if (!res.ok) throw new Error('GET ' + res.status);
      const batch = await res.json();
      if (!batch.length) break;
      for (const b of batch) {
        if (b && b.wikidata_id) {
          const q = String(b.wikidata_id).trim();
          if (q && !blockQid.has(q)) { blockQid.add(q); added++; }
        }
      }
      bfrom += batch.length;
      if (bfrom > 100000) break;
    }
    console.log(`  blocklist 에서 : 번호 ${added}개 더함 (모두 ${blockQid.size}개)`);
  } catch (e) {
    /* ★ 못 읽었으면 멈춥니다. 차단 목록을 모르는 채로 담으면
       지운 인물이 되돌아옵니다. 담지 않는 것이 낫습니다. */
    console.error('✗ blocklist 를 읽지 못했습니다 — 담지 않고 멈춥니다: '
      + String(e.message || e).slice(0, 120));
    process.exit(1);
  }
  console.log('');

  const found = [], skipped = [], missing = [];

  /* ① 위키백과에서 사람을 찾습니다 */
  const blocked = [];

  for (const name of KR_COMPOSERS) {
    if (haveSet.has(onlyKo(name))) { skipped.push(name); continue; }
    /* 한 번 지운 사람은 다시 담지 않습니다 */
    if (blockName.has(onlyKo(name)) || blockName.has(name)) { blocked.push(name); continue; }

    const r = await findPerson(name);
    await new Promise((x) => setTimeout(x, 220));

    /* 위키데이터로 건진 사람은 표시해 둡니다 — 새로 열린 길이라
       얼마나 도움이 되는지 로그로 확인할 수 있어야 합니다 */
    if (r.found && r.via === '위키데이터' && DEBUG) {
      console.log(`  [위키데이터로 찾음] ${name} — ${r.qid}`
                + (r.desc ? ` (${r.desc})` : ''));
    }

    if (!r.found) {
      missing.push({ name: name, why: r.why });
      if (DEBUG) console.log(`  [못 찾음] ${name} — ${r.why}`);
      continue;
    }
    found.push(r);
  }

  /* ② 위키데이터에서 생몰년을 받습니다 — 소개글보다 정확합니다 */
  const qids = found.map((r) => r.qid).filter(Boolean);
  const wdBy = qids.length ? await wdLife(qids) : {};
  if (DEBUG) console.log(`  [위키데이터] 생몰년을 받은 사람 ${Object.keys(wdBy).length}명 / ${qids.length}명\n`);

  /* ③ 담을 것을 짭니다 */
  const rows = [];
  for (const r of found) {
    /* 위키데이터를 먼저, 없으면 소개글에서 */
    const wd = r.qid ? wdBy[r.qid] : null;
    let born = (wd && wd.born) || r.wdBorn || null;
    let died = (wd && wd.died) || null;
    let from = '위키데이터';
    if (!born) {
      const g = pickLife(r.extract);
      born = g.born; died = g.died; from = '소개글';
    }
    const life = born ? (died ? `${born} – ${died}` : `${born}~`) : null;

    /* 생몰년이 너무 옛것이면 같은 이름의 옛 인물입니다 */
    if (born && born < 1850) {
      missing.push({ name: r.name, why: `같은 이름의 옛 인물로 보입니다 (${life})` });
      if (DEBUG) console.log(`  [건너뜀] ${r.name} — 옛 인물 ${life}`);
      continue;
    }
    /* 위키데이터 번호가 블록리스트에 있으면 담지 않습니다 */
    if (r.qid && blockQid.has(r.qid)) {
      blocked.push(r.name);
      if (DEBUG) console.log(`  [건너뜀] ${r.name} — 다시 담지 않을 사람입니다`);
      continue;
    }

    /* 위키데이터 번호가 이미 쓰이고 있으면 번호만 비웁니다.
       같은 번호를 두 사람이 가질 수 없으므로, 사람은 담고 번호는 뺍니다.
       (같은 사람이 두 번 담기는 것은 이름으로 이미 걸러집니다) */
    let qid = r.qid;
    let qidNote = '';
    if (qid && haveQid.has(qid)) { qidNote = ` (위키데이터 번호 ${qid} 는 이미 쓰이고 있어 비웠습니다)`; qid = null; }
    else if (qid) haveQid.add(qid);   /* 이번에 담는 것끼리도 겹치지 않게 */

    if (DEBUG) console.log(`  ${r.name.padEnd(9)} ${(life || '생몰년 없음').padEnd(14)} (${from})${qidNote}`);
    else if (qidNote) console.log(`  ${r.name} —${qidNote}`);

    rows.push({
      name_ko: r.name,
      field: pickField(r.extract),
      /* ★ 표기를 통일합니다 (2026-08-10)
         실제 DB 를 보니 「대한민국」 325명 · 「대한민국 (KOR)」 6명이었고,
         뒤의 여섯은 <b>이 수집기가 넣은 것</b>이었습니다.
         국가 코드는 nat_code 에 따로 들어가므로 이름에 붙일 필요가 없습니다.
         표기가 갈리면 국적으로 거를 때 여섯 명이 빠집니다. */
      nationality: '대한민국',
      nat_code: 'KOR',
      life: life,
      era_name: pickEra(born),
      school: pickSchool(r.extract),
      description: r.extract.slice(0, 900),
      /* ★ 위키데이터로 찾은 사람은 한국어 위키 문서가 <b>없습니다.</b>
         그대로 ko.wikipedia 주소를 만들면 깨진 링크가 됩니다.
         그때는 위키데이터 항목을 가리킵니다. (2026-08-10) */
      link_wiki: (r.via === '위키데이터' && r.qid)
        ? 'https://www.wikidata.org/wiki/' + r.qid
        : 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')),
      wikidata_id: qid,
      is_oc: false,
      hidden: false,
    });
  }

  console.log('── 찾은 결과 ──');
  const viaWd = found.filter((r) => r.via === '위키데이터').length;
  if (viaWd) console.log(`  ※ 그 가운데 ${viaWd}명은 위키데이터로 찾았습니다`
                       + ' (한국어 위키에 문서가 없거나 동명이인에 묻힌 사람)');
  console.log(`담을 사람 ${rows.length}명 · 이미 있어 건너뜀 ${skipped.length}명`
    + `${blocked.length ? ` · 다시 담지 않을 사람 ${blocked.length}명` : ''}`
    + ` · 못 찾음 ${missing.length}명\n`);
  if (blocked.length) {
    console.log('── 다시 담지 않을 사람 (한 번 지운 분들) ──');
    console.log('  ' + blocked.join(', ') + '\n');
  }

  if (rows.length) {
    console.log('── 담을 사람 ──');
    rows.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${r.name_ko.padEnd(9)} ${(r.life || '-').padEnd(13)}`
        + `${(r.era_name || '-').padEnd(7)} ${(r.field === '작곡·국악' ? '국악 ' : '    ')}`
        + `${(r.school || '').slice(0, 20)}`);
    });
    console.log('');
  }

  if (skipped.length) {
    console.log('── 이미 있어 건너뛴 사람 ──');
    console.log('  ' + skipped.join(', ') + '\n');
  }

  if (missing.length) {
    console.log('── 위키백과에서 찾지 못한 사람 ──');
    missing.forEach((m) => console.log(`  ${m.name.padEnd(9)} ${m.why}`));
    console.log('  ※ 이분들은 담지 않았습니다. 다른 자료로 채우실지 판단해 주십시오.\n');
  }

  if (DRY) {
    console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
    console.log('※ 목록을 보시고 엉뚱한 사람이 있으면 알려 주십시오.');
    return;
  }

  if (!rows.length) { console.log('새로 담을 사람이 없습니다.'); return; }

  /* 묶어 담다가 한 사람이 걸리면 그 묶음이 통째로 거부됩니다.
     그래서 실패하면 한 명씩 다시 담아, 걸리는 사람만 빼고 나머지를 지킵니다. */
  let saved = 0;
  const failed = [];

  for (let i = 0; i < rows.length; i += 25) {
    const part = rows.slice(i, i + 25);
    try {
      await sb('persons', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(part),
      });
      saved += part.length;
    } catch (e) {
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 명씩 다시 담습니다`);
      for (const one of part) {
        try {
          await sb('persons', {
            method: 'POST', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([one]),
          });
          saved++;
        } catch (e2) {
          const why = String(e2.message || '');
          /* 무엇 때문에 걸렸는지 알아보기 쉽게 다듬습니다 */
          let short = why;
          const m = why.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/);
          if (m) short = `${m[1]} 값 ${m[2]} 이 이미 있습니다`;
          else if (/violates not-null/.test(why)) short = '비울 수 없는 칸이 비었습니다';
          else if (/column .* does not exist/.test(why)) {
            const c = why.match(/column "?([a-z_]+)"? does not exist/);
            short = `인물DB 에 「${c ? c[1] : '?'}」 칸이 없습니다`;
          }
          failed.push({ name: one.name_ko, why: short });
        }
      }
    }
  }
  console.log('── 끝 ──');
  console.log(`담은 사람 ${saved}명${failed.length ? ` · 담지 못한 사람 ${failed.length}명` : ''}`);
  if (failed.length) {
    console.log('\n── 담지 못한 사람 ──');
    failed.forEach((f) => console.log(`  ${f.name.padEnd(9)} ${f.why}`));
  }
  console.log('※ 출처는 한국어 위키백과(CC BY-SA)이며 각 항목에 링크를 적어 두었습니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
