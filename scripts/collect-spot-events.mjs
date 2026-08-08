/* ============================================================
   OPUSCLAM 정보SPOT — 콩쿨 · 페스티벌 채우기
   scripts/collect-spot-events.mjs

   왜 만들었나
     콩쿨 39건 · 페스티벌 15건. 전 세계를 담는 자리인데 표본에 가깝습니다.
     지금까지는 <b>사람이 쓴 소개</b>(seed/concours-seed.mjs) 29건뿐이었고,
     재단DB 수집기는 콩쿠르를 <b>정확히 music competition 으로 적힌 것만</b>
     보았습니다. 실제 대회는 「피아노 콩쿠르」·「성악 경연」처럼
     <b>더 좁은 갈래</b>로 적혀 있어 그물에 걸리지 않았습니다.

   ★ 첫 실행은 반드시 담지 않고 세어만 보십시오 (기본값이 그렇습니다)
     어제 「위키데이터에 있을 것」이라는 짐작으로 네 번 헛짚었습니다.
     그래서 이 스크립트는 <b>--save 를 붙이지 않으면 아무것도 담지 않습니다.</b>
     대신 무엇이 몇 개 오는지, 표본이 어떻게 생겼는지 보여 줍니다.

   ★ 번호를 짐작하지 않습니다
     분류 번호(Q…)가 틀리면 조용히 0건이 나옵니다. 그래서 실행할 때마다
     번호의 <b>이름을 물어서 로그에 찍습니다.</b> 이름이 엉뚱하면 바로 압니다.

   ★ 하위 갈래까지 봅니다
     ?item wdt:P31 ?type . ?type wdt:P279* wd:(상위) .
     이렇게 물으면 「피아노 콩쿠르」도 「음악 경연」의 한 갈래로 걸립니다.
     그리고 <b>실제로 걸린 갈래 목록을 로그에 찍습니다</b> — 다음에 무엇을
     더할지 그 목록을 보고 정합니다.

   ★ 지어내지 않습니다
     위키데이터에 있는 것만 적습니다. 접수 마감·참가비·상금·나이 제한은
     해마다 바뀌므로 <b>적지 않습니다.</b> 대신 본문 끝에 공식 홈페이지에서
     확인하시라는 안내를 붙입니다. (기존 concours-seed.mjs 와 같은 태도)

   ★ 사람이 쓴 것을 덮지 않습니다
     이미 있는 것은 제목으로도, 위키데이터 번호로도 걸러서 건너뜁니다.

   ★ 지울 수 있게 표시를 남깁니다
     keywords 에 'oc-wd' 가 들어갑니다.
       delete from spot where section in ('콩쿨','페스티벌') and keywords like '%oc-wd%';

   쓰는 법
     node scripts/collect-spot-events.mjs                  세어만 봅니다(기본)
     node scripts/collect-spot-events.mjs --save           실제로 담습니다
     node scripts/collect-spot-events.mjs --kind=concours  콩쿨만
     node scripts/collect-spot-events.mjs --kind=festival  페스티벌만
     node scripts/collect-spot-events.mjs --limit=300      최대 몇 개까지
     node scripts/collect-spot-events.mjs --loose          클래식 잣대를 느슨하게
     node scripts/collect-spot-events.mjs --debug          한 줄씩 자세히

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)
   ============================================================ */

import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SAVE  = !!args.save;
const DEBUG = !!args.debug;
const LOOSE = !!args.loose;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 1200;
const KIND  = (args.kind === 'concours' || args.kind === 'festival') ? args.kind : 'both';

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OpusclamSpotBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const MARK = 'oc-wd';

const getJSON = makeGetJSON({ ua: UA, accept: 'application/sparql-results+json', tries: 5 });

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

/* ── 수집 대상 분류 ──────────────────────────────────────────
   ★ 번호는 실행할 때마다 이름을 확인해 로그에 남깁니다.
     Q1955280 = music competition — 재단DB 수집기에서 이미 쓰고 있는 번호입니다.
     Q868557  = music festival
   ★ 하위 갈래(P279*)까지 봅니다. */
const GROUPS = {
  concours: { qid: 'Q1955280', section: '콩쿨',      label: '음악 경연(콩쿠르)' },
  festival: { qid: 'Q868557',  section: '페스티벌',  label: '음악 축제(페스티벌)' }
};

/* ── 클래식 판정 ─────────────────────────────────────────────
   ★ 이름만 보고 판정하지 않습니다.
     ① 갈래 이름(P31 → 라벨)에 클래식 계열이 있으면 → 받습니다
     ② 장르(P136)가 클래식·오페라 계열이면 → 받습니다   ← 출처에 직접 물은 것
     ③ 이름·설명의 낱말                                  ← 마지막 보조 수단
   어느 근거로 받았는지 로그에 남깁니다. */
const CLASSIC_WORD = /classical|baroque|renaissance|early music|opera|operatic|orchestral|orchestra|symphon|chamber music|choral|choir|lied|art song|recital|conducting|conductor|composition|organ|harpsichord|fortepiano|violin|viola|cello|double bass|piano|voice|vocal|singing|string quartet|contemporary classical|new music|avant-?garde|클래식|고전음악|현대음악|오페라|관현악|교향|실내악|성악|합창|피아노|바이올린|첼로|지휘|작곡|국악|정가|판소리/i;

/* 클래식이 아닌 것이 확실한 표시 — 클래식 근거보다 먼저 걸러냅니다.
   ★ 「rock」이 「Rockefeller」에 걸리지 않도록 낱말 경계를 씁니다. */
const NOT_CLASSIC = /\brock\b|\bpop\b|\bhip.?hop\b|\brap\b|\bjazz fusion\b|\bmetal\b|\bpunk\b|\breggae\b|\btechno\b|\bhouse music\b|\bedm\b|\bcountry music\b|\bfolk rock\b|\bblues\b|\bk-?pop\b|\bidol\b|\btrot\b|댄스|아이돌|힙합|트로트|록 페스티벌|락 페스티벌/i;

/* ── 부문 고르기 ─────────────────────────────────────────────
   화면의 갈래와 <b>글자 하나까지</b> 같아야 합니다.
     콩쿨    : 종합 · 피아노 · 현악 · 관악 · 성악 · 작곡 · 지휘 · 국악
     페스티벌: 종합 · 오페라 · 현대음악 · 피아노 · 고음악 · 실내악 · 성악
   ★ 애매하면 「종합」으로 둡니다. 지어내지 않습니다. */
const CAT_CONCOURS = [
  [/국악|판소리|가야금|거문고|해금|대금|정가|korean traditional|gugak/i, '국악'],
  [/conduct|지휘|dirigent|kapellmeister/i,                                '지휘'],
  [/composition|composer|작곡|komposition/i,                              '작곡'],
  [/voice|vocal|singing|singer|opera sing|성악|voix|gesang|canto/i,        '성악'],
  [/piano|pianist|harpsichord|organ|fortepiano|피아노|오르간|쳄발로/i,      '피아노'],
  [/violin|viola|cello|violoncell|double bass|contrabass|harp|guitar|string|현악|바이올린|비올라|첼로|하프|기타|콘트라베이스/i, '현악'],
  [/flute|oboe|clarinet|bassoon|horn|trumpet|trombone|tuba|saxophon|wind|brass|percussion|timpani|marimba|관악|금관|목관|타악|플루트|오보에|클라리넷|바순|호른|트럼펫|트롬본|색소폰/i, '관악']
];
const CAT_FESTIVAL = [
  [/opera|operatic|오페라|음악극|lyric/i,                                  '오페라'],
  [/early music|baroque|renaissance|medieval|고음악|바로크|르네상스/i,      '고음악'],
  [/contemporary|new music|avant-?garde|modern music|현대음악|신음악/i,     '현대음악'],
  [/chamber|quartet|quintet|실내악|사중주/i,                               '실내악'],
  [/piano|pianist|keyboard|피아노|건반/i,                                  '피아노'],
  [/voice|vocal|choral|choir|lied|song|성악|합창|가곡/i,                    '성악']
];

/* ── 도우미 ─────────────────────────────────────────────── */
const val   = (b, k) => (b && b[k] && b[k].value) || '';
const qidOf = (uri) => (uri || '').replace(/^.*\/entity\//, '');

function pickCat(rules, text) {
  for (const [re, name] of rules) if (re.test(text)) return name;
  return '종합';
}

/* 커먼즈 그림 주소를 우리가 쓰는 모양으로 바꿉니다.
   ★ 이미 검증된 방식입니다 — Special:FilePath 는 원본으로 넘겨줍니다. */
function commons(url) {
  if (!url) return '';
  const m = /\/Special:FilePath\/(.+)$/.exec(url) || /commons\.wikimedia\.org\/wiki\/(?:File|Special:FilePath)[:/](.+)$/.exec(url);
  const name = m ? m[1] : (url.split('/').pop() || '');
  if (!name) return '';
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + name;
}

async function sparql(query) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(query));
  return (d.results && d.results.bindings) || [];
}

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
   끝냄은 0줄일 때만, offset 은 실제로 받은 수만큼. order 에 id 필수. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
  }
  return out;
}

/* ── 분류 번호가 맞는지 확인 ─────────────────────────────── */
async function verifyClasses(list) {
  const vs = list.map(g => 'wd:' + g.qid).join(' ');
  const q = 'SELECT ?c ?cLabel WHERE { VALUES ?c { ' + vs + ' } '
          + '?c rdfs:label ?cLabel FILTER(lang(?cLabel)="en") }';
  try {
    const rows = await sparql(q);
    const names = {};
    for (const b of rows) names[qidOf(val(b, 'c'))] = val(b, 'cLabel');
    for (const g of list) {
      const nm = names[g.qid] || '(이름을 못 받았습니다 — 번호를 의심하십시오)';
      console.log('   ' + g.qid + ' = ' + nm + '  →  ' + g.section);
    }
  } catch (e) {
    console.log('   분류 이름 확인 실패 · 그대로 진행합니다');
  }
}

/* ── 1단계 · 목록 (가볍게) ───────────────────────────────── */
function listQuery(qid, offset, page) {
  return `SELECT DISTINCT ?item WHERE {
  ?item wdt:P31 ?type .
  ?type wdt:P279* wd:${qid} .
}
ORDER BY ?item
LIMIT ${page} OFFSET ${offset}`;
}

/* ── 2단계 · 상세 (150개씩) ──────────────────────────────── */
function detailQuery(qids) {
  const vs = qids.map(q => 'wd:' + q).join(' ');
  return `SELECT ?item ?en ?ko ?descEn ?descKo ?typeLabel ?web
       ?countryLabel ?countryCode ?cityLabel ?inception ?logo ?photo ?genreLabel
WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item rdfs:label ?en    FILTER(lang(?en)="en") }
  OPTIONAL { ?item rdfs:label ?ko    FILTER(lang(?ko)="ko") }
  OPTIONAL { ?item schema:description ?descEn FILTER(lang(?descEn)="en") }
  OPTIONAL { ?item schema:description ?descKo FILTER(lang(?descKo)="ko") }
  OPTIONAL { ?item wdt:P31  ?type .  ?type    rdfs:label ?typeLabel    FILTER(lang(?typeLabel)="en") }
  OPTIONAL { ?item wdt:P136 ?genre . ?genre   rdfs:label ?genreLabel   FILTER(lang(?genreLabel)="en") }
  OPTIONAL { ?item wdt:P856 ?web }
  OPTIONAL { ?item wdt:P17  ?country . ?country rdfs:label ?countryLabel FILTER(lang(?countryLabel)="en")
             OPTIONAL { ?country wdt:P297 ?countryCode } }
  OPTIONAL { ?item wdt:P276 ?city .    ?city    rdfs:label ?cityLabel    FILTER(lang(?cityLabel)="en") }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P18  ?photo }
}`;
}

/* 여러 줄로 나뉘어 오는 것을 하나로 합칩니다 (P31·P136 은 여럿입니다) */
function merge(rows) {
  const map = new Map();
  for (const b of rows) {
    const qid = qidOf(val(b, 'item'));
    if (!qid) continue;
    let o = map.get(qid);
    if (!o) {
      o = { qid, types: new Set(), genres: new Set() };
      map.set(qid, o);
    }
    o.en       = o.en       || val(b, 'en');
    o.ko       = o.ko       || val(b, 'ko');
    o.descEn   = o.descEn   || val(b, 'descEn');
    o.descKo   = o.descKo   || val(b, 'descKo');
    o.web      = o.web      || val(b, 'web');
    o.country  = o.country  || val(b, 'countryLabel');
    o.cc       = o.cc       || val(b, 'countryCode');
    o.city     = o.city     || val(b, 'cityLabel');
    o.inception= o.inception|| val(b, 'inception');
    o.logo     = o.logo     || val(b, 'logo');
    o.photo    = o.photo    || val(b, 'photo');
    const t = val(b, 'typeLabel');  if (t) o.types.add(t);
    const g = val(b, 'genreLabel'); if (g) o.genres.add(g);
  }
  return [...map.values()];
}

/* ── 클래식인지 판정 ─────────────────────────────────────── */
function classify(o) {
  const types  = [...o.types].join(' · ');
  const genres = [...o.genres].join(' · ');
  const name   = [o.en, o.ko].filter(Boolean).join(' ');
  const desc   = [o.descEn, o.descKo].filter(Boolean).join(' ');

  if (NOT_CLASSIC.test(genres) || NOT_CLASSIC.test(name)) {
    return { ok: false, why: '클래식 아님 표시', types, genres };
  }
  if (CLASSIC_WORD.test(types))  return { ok: true, why: '갈래',   types, genres };
  if (CLASSIC_WORD.test(genres)) return { ok: true, why: '장르',   types, genres };
  if (CLASSIC_WORD.test(name))   return { ok: true, why: '이름',   types, genres };
  if (CLASSIC_WORD.test(desc))   return { ok: true, why: '설명',   types, genres };
  if (LOOSE)                     return { ok: true, why: '느슨',   types, genres };
  return { ok: false, why: '클래식 근거 없음', types, genres };
}

/* ── 본문 만들기 ─────────────────────────────────────────
   ★ 위키데이터에 있는 것만 적습니다. 없는 것은 쓰지 않습니다. */
function makeBody(o, section) {
  const bits = [];
  const desc = o.descKo || o.descEn;
  if (desc) bits.push(desc.charAt(0).toUpperCase() + desc.slice(1) + '.');

  const where = [o.city, o.country].filter(Boolean).join(', ');
  const year  = /^(\d{4})/.exec(o.inception || '');
  const facts = [];
  if (where) facts.push('개최지 ' + where);
  if (year)  facts.push(year[1] + '년 시작');
  if (facts.length) bits.push(facts.join(' · ') + '.');

  bits.push(section === '콩쿨'
    ? '접수 기간·부문·참가 자격은 해마다 바뀝니다. 반드시 공식 홈페이지에서 확인해 주십시오.'
    : '연도별 일정과 출연진은 해마다 바뀝니다. 공식 홈페이지에서 확인해 주십시오.');

  return bits.join('\n\n');
}

/* ── 한 갈래 처리 ────────────────────────────────────────── */
async function runGroup(g, have) {
  console.log('\n════════════════════════════════════════════');
  console.log(' ' + g.label + '  (' + g.section + ')');
  console.log('════════════════════════════════════════════');

  /* 목록 받기 */
  const PAGE = 400;
  const qids = [];
  for (let off = 0; off < LIMIT; off += PAGE) {
    let rows;
    try {
      rows = await sparql(listQuery(g.qid, off, Math.min(PAGE, LIMIT - off)));
    } catch (e) {
      if (isStop(e)) { console.log('  ※ ' + e.message); break; }
      throw e;
    }
    if (!rows.length) break;
    for (const b of rows) {
      const q = qidOf(val(b, 'item'));
      if (q) qids.push(q);
    }
    if (rows.length < PAGE) break;
    await sleep(700);
  }
  console.log('\n위키데이터에서 받은 항목 : ' + qids.length + '개');
  if (!qids.length) {
    console.log('  ★ 0개입니다. 분류 번호를 의심하십시오 (위의 이름 확인을 보십시오).');
    return { section: g.section, add: [], skip: 0, drop: 0, typeCount: new Map() };
  }

  /* 상세 받기 */
  const all = [];
  for (let i = 0; i < qids.length; i += 150) {
    const part = qids.slice(i, i + 150);
    let rows;
    try {
      rows = await sparql(detailQuery(part));
    } catch (e) {
      if (isStop(e)) { console.log('  ※ ' + e.message + ' — 여기까지 모은 것으로 진행합니다'); break; }
      console.log('  · 상세 ' + (i + 1) + '~ 실패 · 건너뜁니다 (' + (e.message || '').slice(0, 60) + ')');
      continue;
    }
    all.push(...merge(rows));
    await sleep(700);
  }
  console.log('상세를 받은 항목     : ' + all.length + '개');

  /* 걸러내기 */
  const typeCount = new Map();
  const whyCount  = new Map();
  const add = [];
  let skip = 0, drop = 0;

  for (const o of all) {
    for (const t of o.types) typeCount.set(t, (typeCount.get(t) || 0) + 1);

    const c = classify(o);
    whyCount.set(c.why, (whyCount.get(c.why) || 0) + 1);
    if (!c.ok) { drop++; if (DEBUG) console.log('   [뺌] ' + (o.en || o.qid) + ' — ' + c.why); continue; }

    const title = (o.ko || o.en || '').trim();
    if (!title) { drop++; continue; }

    /* 이미 있는 것 — 위키데이터 번호로도, 제목으로도 봅니다.
       사람이 쓴 29건에는 번호가 없어서 제목으로만 걸러집니다. */
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (have.qids.has(o.qid) || have.titles.has(key)) { skip++; continue; }

    const isKR  = /^(South Korea|Korea)$/i.test(o.country || '') || o.cc === 'KR';
    const text  = [o.en, o.ko, o.descEn, o.descKo, [...o.types].join(' ')].filter(Boolean).join(' ');
    const cat   = pickCat(g.section === '콩쿨' ? CAT_CONCOURS : CAT_FESTIVAL, text);
    const year  = /^(\d{4})/.exec(o.inception || '');
    const img   = commons(o.logo) || commons(o.photo);

    add.push({
      section:      g.section,
      title:        title,
      title_ko:     o.ko || null,
      title_en:     o.en || null,
      body:         makeBody(o, g.section),
      category:     cat,
      region:       isKR ? '국내' : '해외',
      country:      o.country || null,
      city:         o.city || null,
      link_url:     o.web || null,
      logo_url:     commons(o.logo) || null,
      thumb_url:    img || null,
      wikidata_id:  o.qid,
      is_competition: g.section === '콩쿨',
      date_text:    year ? (year[1] + '년 시작') : null,
      source:       'Wikidata',
      source_url:   'https://www.wikidata.org/wiki/' + o.qid,
      keywords:     [MARK, g.section, cat, o.country, o.city].filter(Boolean).join(' '),
      author_name:  'OPUSCLAM 자동수집',
      hidden:       false
    });
  }

  /* 보고 */
  console.log('\n── 걸러낸 까닭 ──');
  [...whyCount.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(5) + '  ' + k));

  console.log('\n── 실제로 걸린 갈래 (위 20개) ──');
  console.log('   ※ 여기 보이는 갈래가 우리가 몰랐던 대회의 종류입니다.');
  [...typeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(5) + '  ' + k));

  const withWeb = add.filter(a => a.link_url).length;
  const withImg = add.filter(a => a.thumb_url).length;
  const withKo  = add.filter(a => a.title_ko).length;
  const krCnt   = add.filter(a => a.region === '국내').length;

  console.log('\n── 새로 담을 수 있는 것 ──');
  console.log('   모두            : ' + add.length + '개');
  console.log('   공식 홈페이지 有: ' + withWeb + '개  ← 이게 있어야 쓸모가 있습니다');
  console.log('   그림 有         : ' + withImg + '개');
  console.log('   한국어 이름 有  : ' + withKo + '개');
  console.log('   국내 대회       : ' + krCnt + '개');
  console.log('   이미 있어 건너뜀: ' + skip + '개');

  const catCount = new Map();
  add.forEach(a => catCount.set(a.category, (catCount.get(a.category) || 0) + 1));
  console.log('\n── 부문별 ──');
  [...catCount.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(5) + '  ' + k));

  console.log('\n── 표본 20개 (이 모양으로 담깁니다) ──');
  add.slice(0, 20).forEach((a, i) => {
    console.log('   ' + String(i + 1).padStart(2) + '. ' + a.title
      + '  [' + a.region + '·' + a.category + ']'
      + (a.country ? ' · ' + a.country : '')
      + (a.link_url ? ' · 홈피O' : ' · 홈피X'));
  });

  return { section: g.section, add, skip, drop, typeCount };
}

/* ── 담기 ────────────────────────────────────────────────
   ★ 200개 묶음에 하나만 걸려도 전체가 거부됩니다.
     그래서 거부되면 한 건씩 다시 넣습니다. */
async function save(rows) {
  let ok = 0, ng = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50);
    try {
      await rest('spot', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(part)
      });
      ok += part.length;
    } catch (e) {
      for (const one of part) {
        try {
          await rest('spot', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([one])
          });
          ok++;
        } catch (e2) {
          ng++;
          console.log('   [실패] ' + one.title + ' — ' + (e2.message || '').slice(0, 120));
        }
      }
    }
    process.stdout.write('   담는 중 ' + ok + '/' + rows.length + '\r');
  }
  console.log('   담기 끝 · 성공 ' + ok + '개 · 실패 ' + ng + '개        ');
  return ok;
}

/* ── 본체 ────────────────────────────────────────────────── */
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  정보SPOT 콩쿨 · 페스티벌 채우기             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 담습니다 (--save)\n'
                   : '\n※ 담지 않고 세어만 봅니다. 담으시려면 --save 를 붙이십시오.\n');
  if (LOOSE) console.log('※ 클래식 잣대를 느슨하게 두었습니다 (--loose)\n');

  const groups = KIND === 'both'
    ? [GROUPS.concours, GROUPS.festival]
    : [GROUPS[KIND]];

  console.log('── 분류 번호 확인 (이름이 엉뚱하면 번호가 틀린 것입니다) ──');
  await verifyClasses(groups);

  /* 이미 있는 것 */
  console.log('\n── 지금 있는 것 ──');
  const have = { qids: new Set(), titles: new Set() };
  for (const g of groups) {
    const rows = await getAll('spot?select=id,title,title_en,wikidata_id'
      + '&section=eq.' + encodeURIComponent(g.section) + '&order=id.asc');
    rows.forEach(r => {
      if (r.wikidata_id) have.qids.add(r.wikidata_id);
      [r.title, r.title_en].forEach(t => {
        if (t) have.titles.add(String(t).replace(/\s+/g, '').toLowerCase());
      });
    });
    console.log('   ' + g.section + ' : ' + rows.length + '건');
  }

  const results = [];
  for (const g of groups) results.push(await runGroup(g, have));

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  마무리                                      ║');
  console.log('╚══════════════════════════════════════════════╝');
  for (const r of results) {
    console.log('   ' + r.section + ' : 새로 담을 수 있는 것 ' + r.add.length + '개');
  }

  if (!SAVE) {
    console.log('\n※ 아무것도 담지 않았습니다.');
    console.log('  숫자가 마음에 드시면 --save 를 붙여 다시 돌려 주십시오.');
    return;
  }

  for (const r of results) {
    if (!r.add.length) continue;
    console.log('\n── ' + r.section + ' 담기 ──');
    await save(r.add);
  }
  console.log('\n끝났습니다.');
  console.log('※ 되돌리시려면:');
  console.log("   delete from spot where section in ('콩쿨','페스티벌') and keywords like '%" + MARK + "%';");
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
