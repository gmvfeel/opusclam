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
const LIST  = !!args.list;   /* \ubc1b\uae30\ub85c \ud55c \uac83\uc744 \uc804\ubd80 \ucc0d\uc2b5\ub2c8\ub2e4 */
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 3000;
const KIND  = (args.kind === 'concours' || args.kind === 'festival') ? args.kind : 'both';

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OpusclamSpotBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const MARK = 'oc-wd';

/* ★ 위키데이터는 짧은 동안 많이 물으면 「몇 분 뒤에 오라」고 합니다(HTTP 429).
   공용 모듈의 기본 기다림 상한은 90초라 「2분 뒤」에서 멈춰 버렸습니다.
   이 수집기는 하루에 한번 돌리는 것이라 더 기다려도 괜찮습니다. */
const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 6,
  maxWaitMs: 200 * 1000,        /* 자료원이 3분까지 기다리라 하면 기다립니다 */
  budgetMs: 45 * 60 * 1000,     /* 워크플로 제한(60분)보다 안쪽 */
  backoff: [5000, 20000, 45000, 90000, 150000, 200000]
});

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

/* ── 무엇을 받고 무엇을 뺄지 ────────────────────────────────
   ★ 2026-08-08 첫 조사에서 드러난 것을 반영했습니다.
     1,200개를 훑었더니 절반 가까이가 <b>유로비전 송 콘테스트 예선</b>과
     <b>일본 홍백가합전</b>이었습니다. 「singing competition」이라는 갈래로
     적혀 있어서, 낱말 `singing` 하나로 전부 클래식이 되어 버렸습니다.
       53 Eurovision Song Contest edition   53 Kohaku Uta Gassen
       47 Eurovision selection event        43 Sopot International Song Festival
       40 German preliminary rounds         36 Melodifestivalen edition
      101 television program                50 entertainment television program
     또 219개가 「annual music competition <b>edition</b>」 — 대회가 아니라
     <b>개별 회차</b>(제57회 … 2021)였습니다. 어제 작품DB에서 판본·묶음을
     걸러낸 것과 같은 문제입니다.

   ★ 그래서 잣대를 셋으로 나눕니다.
     ① 막음   — 회차 · 가요제 · 방송 프로그램 · 대중음악
     ② 확실   — 갈래 이름 자체가 클래식인 것 (classical music competition …)
     ③ 넓음   — music competition / music festival 처럼 <b>너무 넓은 갈래</b>.
                이것만으로는 받지 않고 <b>이름·설명에 클래식 근거</b>가 있어야 합니다.

   ★ 어제 배운 것을 그대로 지킵니다.
     「musical work/composition」이 69%를 차지하고도 쓸모없었던 것과 같습니다.
     넓은 값은 근거가 아닙니다. */

/* ① 막음 — 무엇보다 먼저 봅니다 */
const BLOCK = new RegExp([
  '\\bedition\\b',                    // 개별 회차
  'eurovision', 'song contest',
  'sopot international song',        // 폴란드 대중가요제 (갈래 이름으로 43건)
  'melodifestivalen', 'melodi grand prix', 'dansk melodi',
  'evrovizijska', 'sanremo', 'uta gassen',
  'preliminary round', 'selection event', 'national final',
  'nation in the',
  'television program', 'television series', 'entertainment television',
  'talent show', 'reality (?:television|show)', 'game show',
  'beauty pageant', 'eisteddfod'          // 아이스테드바드는 웨일스 문화축제
].join('|'), 'i');

/* 대중음악 — 장르나 이름에 있으면 뺍니다 */
const NOT_CLASSIC = /\brock\b|\bpop\b|\bpop music\b|\bhip.?hop\b|\brap\b|\bjazz\b|\bmetal\b|\bpunk\b|\breggae\b|\breggaeton\b|\btechno\b|\bhouse music\b|\bedm\b|\belectronic dance\b|\bcountry music\b|\bfolk\b|\bblues\b|\bk-?pop\b|\bidol\b|\btrot\b|\bschlager\b|\bchanson fran|\breggaeton\b|\bbeach fest|\bopen air\b|\bspring sing\b|volksmusik|\bflamenco\b|accord[ée]on|accordion|\betno\b|\beurodance\b|grand prix\b(?!.*(?:chartres|piano|violin))/i;

/* ★ 이름에만 있는 회차 — 갈래에 edition 이 없어도 걸러냅니다.
     첫 조사에서 이런 것들이 남았습니다.
       XVI · XVII · XVIII · XIX · XX International Chopin Piano Competition
       2015 Leeds · 2018 Queen Elisabeth · Basel … 2025 · Schapira, 1981
       제1회 시대 악기 국제 쇼팽 콩쿠르 · 43th Kladrubé léto
     대회 이름에 해마다 달라지는 숫자가 붙어 있으면 회차입니다.
     ★ 로마숫자는 두 글자 이상만 봅니다 — 「I」·「V」는 영어 낱말과 엉길립니다. */
const EDITION_NAME = new RegExp([
  '^[IVXLCDM]{2,7}\\s+\\S',            // XIX International Chopin…
  '^\\d{1,3}(?:st|nd|rd|th)\\s',        // 43th Kladrubé…
  '^(?:19|20)\\d{2}\\s',                // 2015 Leeds…
  '\\b(?:19|20)\\d{2}\\s*$',          // … Competition 2025
  ',\\s*(?:19|20)\\d{2}\\s*$',        // … competition, 1981
  '^\\uc81c\\s*\\d+\\s*\\ud68c'   // 제1회 …
].join('|'), 'i');

/* ② 확실 — 갈래 이름 자체가 클래식인 것 */
const STRONG_TYPE = new RegExp([
  'classical music',
  'opera (?:festival|competition|house)', 'operatic',
  'chamber music', 'early music', 'baroque', 'renaissance music',
  'contemporary classical', 'new music',
  '(?:piano|violin|cello|viola|organ|harpsichord|guitar|harp|flute|oboe|clarinet|bassoon|horn|trumpet|conducting|composition|choral|vocal)\\s+(?:competition|festival|contest)',
  'orchestra', 'symphon', 'philharmon', 'concerto',
  'lied', 'art song', 'oratorio', 'cantata'
].join('|'), 'i');

/* ③ 넓음 — 이것만으로는 받지 않습니다 */
const BROAD_TYPE = /^(?:music competition|music festival|annual music competition|annual event|recurring event|singing competition|song competition|festival|music award|organization|competition|contest)$/i;

/* 이름·설명에서 찾는 클래식 근거
   ★ 영어 singing · song 은 넣지 않습니다 — 유로비전이 전부 그 낱말입니다.
   ★ 대신 다른 나라 말을 넉넉히 넣었습니다. 「Bundeswettbewerb Gesang」처럼
     진짜 클래식 대회가 영어가 아니어서 걸러지면 안 됩니다. */
const CLASSIC_NAME = new RegExp([
  // 영어
  'classical', 'baroque', 'renaissance', 'early music', 'opera', 'operatic',
  'orchestr', 'symphon', 'philharmon', 'chamber music', 'string quartet',
  'choral', 'choir', 'lied', 'art song', 'oratorio', 'cantata', 'recital',
  'conservator', 'conducting', 'conductor', 'composition',
  'piano', 'pianist', 'organ', 'harpsichord', 'fortepiano',
  'violin', 'viola', 'cello', 'violoncello', 'double bass', 'contrabass', 'harp',
  'flute', 'oboe', 'clarinet', 'bassoon', 'saxophon',
  'horn', 'trumpet', 'trombone', 'tuba', 'percussion', 'marimba',
  // 독일어
  'wettbewerb', 'gesang', 'klavier', 'geige', 'violine', 'musikfest',
  'kammermusik', 'chor\\b', 'orchester', 'dirigent',
  // 프랑스어
  'concours', 'chant\\b', 'violon', 'orchestre', 'musique ancienne',
  // 이탈리아어 · 스페인어 · 폴란드어 · 체코어
  'concorso', 'pianoforte', 'canto\\b', 'lirico',
  'concurso', 'konkurs', 'soutěž',
  // 한국어
  '클래식', '고전음악', '현대음악', '오페라', '관현악', '교향', '실내악',
  '성악', '합창', '피아노', '바이올린', '비올라', '첼로', '하프',
  '플루트', '오보에', '클라리넷', '지휘', '작곡', '국악', '정가', '판소리',
  '음악콩쿠르', '음악 콩쿠르', '콩쿠르', '콩쿨'
].join('|'), 'i');

/* ── 부문 고르기 ─────────────────────────────────────────────
   화면의 갈래와 <b>글자 하나까지</b> 같아야 합니다.
     콩쿨    : 종합 · 피아노 · 현악 · 관악 · 성악 · 작곡 · 지휘 · 국악
     페스티벌: 종합 · 오페라 · 현대음악 · 피아노 · 고음악 · 실내악 · 성악
   ★ 애매하면 「종합」으로 둡니다. 지어내지 않습니다. */
const CAT_CONCOURS = [
  [/\uad6d\uc545|\ud310\uc18c\ub9ac|\uac00\uc57c\uae08|\uac70\ubb38\uace0|\ud574\uae08|\ub300\uae08|\uc815\uac00|\uc0ac\uc2b5|korean traditional|gugak|pansori/i, '\uad6d\uc545'],
  [/conduct|\uc9c0\ud718|dirigent|dirigenten|kapellmeister|direction d.orchestre/i, '\uc9c0\ud718'],
  [/composition|composer|\uc791\uacf1|\uc791\uace1|komposition|kompositions|composizione|composici[oó]n/i, '\uc791\uace1'],
  [/voice|vocal|opera sing|\bsinging\b|\bsinger\b|\bsong\b|soprano|mezzo|tenor|baritone|\uc131\uc545|gesang|canto\b|chant\b|vokal|lied\b|aria\b|choral|choir|chor\b|coro\b/i, '\uc131\uc545'],
  [/piano|pianist|pianistico|harpsichord|\borgan\b|organist|organ competition|fortepiano|klavier|klav[ií]r|clavier|\ud53c\uc544\ub178|\uc624\ub974\uac04|\ucf40\ubc1c\ub85c/i, '\ud53c\uc544\ub178'],
  [/violin|violino|violon|violine|geige|viola|\bcello\b|violoncell|double bass|contrabass|\bharp\b|guitar|guitarra|chitarra|string quartet|\bstrings?\b|\ud604\uc545|\ubc14\uc774\uc62c\ub9b0|\ube44\uc62c\ub77c|\uccbc\ub85c|\ud558\ud504|\uae30\ud0c0/i, '\ud604\uc545'],
  [/flute|fl[uû]te|fl\u00f6te|oboe|clarinet|klarinette|bassoon|fagott|\bhorn\b|trumpet|trompete|tromba|trombon|tuba|saxophon|\bwind\b|blasmusik|brass band|percussion|schlagzeug|timpani|marimba|\uad00\uc545|\uae08\uad00|\ubaa9\uad00|\ud0c0\uc545|\ud50c\ub8e8\ud2b8|\uc624\ubcf4\uc5d0|\ud074\ub77c\ub9ac\ub137|\ubc14\uc21c|\ud638\ub978|\ud2b8\ub7fc\ud3ab/i, '\uad00\uc545']
];
const CAT_FESTIVAL = [
  [/\bopera\b|operatic|opernfest|op[ée]ra|\uc624\ud398\ub77c|\uc74c\uc545\uadf9/i, '\uc624\ud398\ub77c'],
  [/early music|alte musik|musique ancienne|baroque|barock|renaissance|medieval|h[aä]ndel|\uace0\uc74c\uc545|\ubc14\ub85c\ud06c|\ub974\ub124\uc0c1\uc2a4/i, '\uace0\uc74c\uc545'],
  [/contemporary|new music|neue musik|avant-?garde|modern music|\ud604\ub300\uc74c\uc545|\uc2e0\uc74c\uc545/i, '\ud604\ub300\uc74c\uc545'],
  [/chamber|kammermusik|musique de chambre|quartet|quintet|\uc2e4\ub0b4\uc545|\uc0ac\uc911\uc8fc/i, '\uc2e4\ub0b4\uc545'],
  [/piano|klavier|pianist|\ud53c\uc544\ub178|\uac74\ubc18/i, '\ud53c\uc544\ub178'],
  [/voice|vocal|choral|choir|\bchor\b|lied\b|gesang|\uc131\uc545|\ud569\ucc3d|\uac00\uace1/i, '\uc131\uc545']
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
  const types  = [...o.types].join(' \u00b7 ');
  const genres = [...o.genres].join(' \u00b7 ');
  const name   = [o.en, o.ko].filter(Boolean).join(' ');
  const desc   = [o.descEn, o.descKo].filter(Boolean).join(' ');
  const all    = [name, desc].join(' ');

  /* ① 막음이 가장 먼저입니다 */
  if (BLOCK.test(types) || BLOCK.test(name)) {
    return { ok: false, why: '\ub9c9\uc74c(\ud68c\ucc28\u00b7\uac00\uc694\uc81c\u00b7\ubc29\uc1a1)' };
  }
  if (EDITION_NAME.test(name.trim())) {
    return { ok: false, why: '\ub9c9\uc74c(\uc774\ub984\uc774 \ud68c\ucc28)' };
  }
  if (NOT_CLASSIC.test(genres) || NOT_CLASSIC.test(name)) {
    return { ok: false, why: '\ub9c9\uc74c(\ub300\uc911\uc74c\uc545)' };
  }

  /* ② 갈래 이름 자체가 클래식이면 받습니다 */
  if (STRONG_TYPE.test(types)) return { ok: true, why: '\uac08\ub798(\ud655\uc2e4)' };

  /* 장르를 출처에 직접 물은 것 — 다음으로 믿을 만합니다 */
  if (/classical|opera|baroque|chamber music|early music|contemporary classical/i.test(genres)) {
    return { ok: true, why: '\uc7a5\ub974' };
  }

  /* ③ 넓은 갈래뿐이면 이름\u00b7설명에 근거가 있어야 합니다 */
  if (CLASSIC_NAME.test(all)) return { ok: true, why: '\uc774\ub984\u00b7\uc124\uba85' };

  const onlyBroad = [...o.types].every(t => BROAD_TYPE.test(t.trim()));
  if (LOOSE && onlyBroad) return { ok: true, why: '\ub290\uc2ac(--loose)' };

  return { ok: false, why: onlyBroad ? '\ub108\ubb34 \ub113\uc740 \uac08\ub798\ub9cc \uc788\uc74c' : '\ud074\ub798\uc2dd \uadfc\uac70 \uc5c6\uc74c' };
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
  let stopped = false;   /* 속도 제한으로 멈췄는지 */
  for (let off = 0; off < LIMIT; off += PAGE) {
    let rows;
    try {
      rows = await sparql(listQuery(g.qid, off, Math.min(PAGE, LIMIT - off)));
    } catch (e) {
      if (isStop(e)) { stopped = true; console.log('  ※ ' + e.message); break; }
      throw e;
    }
    if (!rows.length) break;
    for (const b of rows) {
      const q = qidOf(val(b, 'item'));
      if (q) qids.push(q);
    }
    if (rows.length < PAGE) break;
    await sleep(1500);
  }
  console.log('\n위키데이터에서 받은 항목 : ' + qids.length + '개');
  if (!qids.length) {
    if (stopped) {
      console.log('  ※ 자료가 없어서가 아닙니다 — 위키데이터가 속도 제한을 걸었습니다.');
      console.log('    잠시(20~30분) 뒤에 다시 돌려 주십시오. 분류 번호는 위에서 확인되었습니다.');
    } else {
      console.log('  ★ 0개입니다. 분류 번호를 의심하십시오 (위의 이름 확인을 보십시오).');
    }
    return { section: g.section, add: [], skip: 0, drop: 0, typeCount: new Map(), stopped };
  }

  /* 상세 받기 */
  const all = [];
  for (let i = 0; i < qids.length; i += 150) {
    const part = qids.slice(i, i + 150);
    let rows;
    try {
      rows = await sparql(detailQuery(part));
    } catch (e) {
      if (isStop(e)) { stopped = true; console.log('  ※ ' + e.message + ' — 여기까지 모은 것으로 진행합니다'); break; }
      console.log('  · 상세 ' + (i + 1) + '~ 실패 · 건너뜁니다 (' + (e.message || '').slice(0, 60) + ')');
      continue;
    }
    all.push(...merge(rows));
    await sleep(1500);
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
    /* ★ 이미 있는 것 · 이번에 이미 담기로 한 것 둘 다 거릅니다.
       첫 조사에서 Carl Flesch · NZCT Chamber Music 이 두 번씩 나왔고,
       Wieniawski · Grand Prix de Chartres 는 콩쿨과 페스티벌 양쪽에 있었습니다. */
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (have.qids.has(o.qid) || have.titles.has(key)) { skip++; continue; }
    have.qids.add(o.qid);
    have.titles.add(key);

    const isKR  = /^(South Korea|Korea)$/i.test(o.country || '') || o.cc === 'KR';
    /* ★ 부문은 <b>이름을 먼저</b> 봅니다.
       설명이 이름을 이기면 「Dallas International Violin Competition」이
       설명 속 piano 때문에 피아노가 됩니다. 이름에서 못 찾을 때만 설명을 봅니다. */
    const rules = g.section === '콩쿨' ? CAT_CONCOURS : CAT_FESTIVAL;
    const nameT = [o.en, o.ko].filter(Boolean).join(' ');
    const restT = [o.descEn, o.descKo, [...o.types].join(' ')].filter(Boolean).join(' ');
    let cat = pickCat(rules, nameT);
    if (cat === '종합') cat = pickCat(rules, restT);
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
      hidden:       false,
      why:          c.why          /* 로그에만 씁니다 — 담기 전에 지웁니다 */
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

  const show = LIST ? add.length : 20;
  console.log('\n── ' + (LIST ? '받기로 한 것 전부' : '표본 20개') + ' (이 모양으로 담깁니다) ──');
  if (!LIST && add.length > 20) console.log('   ※ 전부 보시려면 --list 를 붙이십시오.');
  add.slice(0, show).forEach((a, i) => {
    console.log('   ' + String(i + 1).padStart(2) + '. ' + a.title
      + '  [' + a.region + '·' + a.category + ']'
      + (a.country ? ' · ' + a.country : '')
      + (a.link_url ? ' · 홈피O' : ' · 홈피X')
      + (a.why ? ' · ' + a.why : ''));
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
  let anyStopped = false;
  for (const r of results) {
    console.log('   ' + r.section + ' : 새로 담을 수 있는 것 ' + r.add.length + '개'
      + (r.stopped ? '   ※ 속도 제한으로 중간에 멈췄습니다' : ''));
    if (r.stopped) anyStopped = true;
  }
  if (anyStopped) {
    console.log('\n※ 위키데이터가 속도 제한을 걸어 다 받지 못했습니다.');
    console.log('  20~30분 뒤에 다시 돌리시면 이어서 받습니다.');
    console.log('  급하시면 「한 갈래씩」(콩쿨만 → 페스티벌만) 나눠 돌리셔도 됩니다.');
  }

  if (!SAVE) {
    console.log('\n※ 아무것도 담지 않았습니다.');
    console.log('  숫자가 마음에 드시면 --save 를 붙여 다시 돌려 주십시오.');
    return;
  }

  for (const r of results) {
    if (!r.add.length) continue;
    console.log('\n── ' + r.section + ' 담기 ──');
    /* 로그용으로만 쓰던 칸은 빼고 담습니다 (spot 에 없는 칸입니다) */
    await save(r.add.map(x => { const y = { ...x }; delete y.why; return y; }));
  }
  console.log('\n끝났습니다.');
  console.log('※ 되돌리시려면:');
  console.log("   delete from spot where section in ('콩쿨','페스티벌') and keywords like '%" + MARK + "%';");
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
