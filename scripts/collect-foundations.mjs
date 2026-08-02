// ============================================================
// OPUSCLAM 해외 기관·재단(foundations) 자동 수집기 (v1)
//
//  국내 기관은 위키데이터에 정보가 거의 없어 자동 수집이 어렵습니다.
//  반면 해외 음반사·콩쿠르는 잘 등록돼 있어 이 수집기로 채울 수 있습니다.
//
//  국내 데이터를 지키는 방법
//    수집기는 wikidata_id 가 있는 행만 다룹니다.
//    사람이 넣은 39곳은 wikidata_id 가 비어 있으므로 절대 덮어쓰지 않습니다.
//
//  오염을 막는 관문
//    ① 클래식 근거가 없으면 받지 않습니다 (대중음악 레이블 · 경연 배제)
//    ② 이름만 있고 나머지가 빈 항목은 받지 않습니다
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            FOUNDATIONS_DRY=1 이면 저장하지 않고 판정 결과만 보여줍니다
// ============================================================

// 바깥 자료원 호출은 공용 모듈이 담당합니다 · scripts/lib/http.mjs
//   429 대기 상한 90초 · 실행 예산 25분 · 막히면 모은 것까지 저장하고 정상 종료합니다.
//   이 정책을 고치려면 http.mjs 한 곳만 고치면 모든 수집기에 반영됩니다.
import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1.1';   // 공용 http 모듈 적용판 (로그에서 새 코드인지 구분하는 표시)
const DRY     = process.env.FOUNDATIONS_DRY === '1';
const UA      = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const SPARQL  = 'https://query.wikidata.org/sparql';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// 수집 대상 분류.
// 번호가 맞는지 실행할 때마다 이름을 확인해 로그에 남깁니다.
//   Q18127   = record label      (음반사)
//   Q1955280 = music competition (음악 경연)
const CLASSES = [
  { qid: 'Q18127',   type: '음반사' },
  { qid: 'Q1955280', type: '콩쿠르 · 시상' },
];

// ── 판정 규칙 ────────────────────────────────────────────────
// 클래식 근거. 이름 · 소개 · 장르 어디에든 있으면 받습니다.
const CLASSIC_OK = /classical|baroque|renaissance music|opera|operatic|orchestral|chamber music|early music|symphon|art music|contemporary classical|avant-?garde|new music|choral|lied|recital|conservator|philharmon|클래식|고전음악|현대음악/i;

// 위키데이터 설명에 classical 이 없어도 실제로는 클래식 전문인 곳이 많습니다.
// 그래서 널리 알려진 이름을 따로 둡니다.
// (Decca · Hyperion · Chandos 같은 곳이 '클래식 근거 없음' 으로 걸러지고 있었습니다)
const KNOWN_CLASSIC = /deutsche grammophon|decca|philips classics|sony classical|columbia masterworks|rca red seal|erato|teldec|telarc|hyperion|chandos|\bbis\b|naxos|harmonia mundi|alpha classics|\bcpo\b|supraphon|hungaroton|melodiya|ondine|\bbb\b ?ryton|nimbus records|delos|dorian|channel classics|pentatone|linn records|onyx classics|signum classics|glossa|ricercar|accent records|astrée|\becm\b|winter & winter|hat hut|kairos|wergo|mode records|neos|col legno|aeon|zig-?zag territoires|arcana|opus 111|virgin classics|emi classics|warner classics|universal edition|schott|breitkopf|bärenreiter|henle|peters edition|boosey|ricordi|durand|salabert/i;

// 대중음악 표시. 클래식 근거보다 우선해서 걸러냅니다.
const POP_DENY = /\bpop\b|\brock\b|hip ?hop|\brap\b|r&b|soul music|electronic dance|\bedm\b|heavy metal|death metal|punk|reggae|country music|k-?pop|j-?pop|idol|techno|house music|trance|\bfunk\b|disco|gospel|christian rock|indie rock|grunge|emo\b|트로트|dubstep|drum and bass/i;

// 이름에 브랜드 성격이 강한 대형 대중음악 그룹은 이름만으로도 걸러냅니다.
const LABEL_DENY = /universal music group|warner music group|sony music entertainment|hybe|smtown|jyp|yg entertainment|kakao entertainment|def jam|interscope|atlantic records|columbia records\b|capitol records|island records|virgin records\b|epic records|republic records|motown/i;

// ── 공통 유틸 ────────────────────────────────────────────────
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

/* ★ 이름을 견주기 위한 자 — 소문자로 바꾸고 공백을 없앱니다.
   음악단체·공연장·음악학교 수집기가 쓰는 것과 <b>같은 방식</b>입니다.

   왜 필요한가
     이 수집기는 위키데이터 번호로만 중복을 보았습니다. 그런데
     「EBS」 와 「Ebs」 는 <b>서로 다른 위키데이터 항목</b>이라 둘 다 통과해
     화면에 같은 곳이 두 번 보이게 됩니다. 위키데이터에는 같은 회사가
     표기만 달리 등재된 경우가 흔합니다. */
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').trim();
const clean = (s) => isEmpty(s) ? null : String(s).replace(/\s+/g, ' ').trim();
const val = (b, k) => (b[k] && b[k].value) ? String(b[k].value) : '';
const qidOf = (uri) => String(uri || '').split('/').pop();

const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 5,
});

async function sparql(query) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(query));
  return (d.results && d.results.bindings) || [];
}

// ── 분류 이름 확인 ───────────────────────────────────────────
// 번호를 코드에 적어두면 잘못됐을 때 조용히 0건이 나옵니다.
// 그래서 실행할 때마다 이름을 확인해 로그로 남깁니다.
async function verifyClasses() {
  const vs = CLASSES.map(c => 'wd:' + c.qid).join(' ');
  const q = 'SELECT ?c ?cLabel WHERE { VALUES ?c { ' + vs + ' } '
          + '?c rdfs:label ?cLabel FILTER(lang(?cLabel)="en") }';
  try {
    const rows = await sparql(q);
    const names = {};
    for (const b of rows) names[qidOf(val(b, 'c'))] = val(b, 'cLabel');
    for (const c of CLASSES) {
      console.log('   ' + c.qid + ' = ' + (names[c.qid] || '(이름을 못 받았습니다)')
                  + ' → ' + c.type);
    }
  } catch (e) {
    console.log('   분류 이름 확인 실패 · 그대로 진행합니다');
  }
}

// ── 수집 ─────────────────────────────────────────────────────
// 한 번의 요청에 모든 항목을 달라고 하면 위키데이터가 500 오류를 냅니다.
// 음반사는 수만 개라서 OPTIONAL 을 여럿 붙인 쿼리를 견디지 못합니다.
// 그래서 두 단계로 나눕니다.
//   1단계 · 목록만 가볍게 받습니다
//   2단계 · 150개씩 묶어 상세를 받습니다 (VALUES 로 범위가 좁아 빠릅니다)

/* ★ 목록을 나눠 받습니다.

   예전에는 `LIMIT 4000` 이었습니다. 그런데 실제 로그에 「목록 4000건」 이
   정확히 찍혔습니다 — 딱 맞는 숫자는 <b>잘렸다는 신호</b>입니다.
   음반사는 위키데이터에 수만 개가 있으니, 4001번째부터는 아예 보지 못하고
   버려지고 있었습니다. 늘 같은 앞부분만 훑으니 「신규 저장 0」 이 되는 것도
   당연했습니다.

   ORDER BY 를 두어 나눠 받을 때 순서가 흔들리지 않게 합니다.
   (순서가 없으면 같은 항목을 두 번 받거나 빠뜨릴 수 있습니다) */
const LIST_PAGE = 5000;                                        // 한 번에 받을 개수
const LIST_MAX  = parseInt(process.env.LIST_MAX || '0', 10);   // 0 이면 제한 없음

function listQuery(clsQid, offset) {
  return `
SELECT ?item WHERE {
  ?item wdt:P31 wd:${clsQid} .
}
ORDER BY ?item
LIMIT ${LIST_PAGE} OFFSET ${offset}`;
}

/* 한 분류의 번호를 끝까지 받습니다 */
async function listAll(cls) {
  const out = [];
  for (let off = 0; ; off += LIST_PAGE) {
    const rows = await sparql(listQuery(cls.qid, off));
    const ids = rows.map(b => qidOf(val(b, 'item'))).filter(Boolean);
    out.push(...ids);
    if (ids.length < LIST_PAGE) break;          // 마지막 쪽입니다
    if (LIST_MAX && out.length >= LIST_MAX) {   // 시험할 때 줄여 보고 싶으면 LIST_MAX 로
      console.log('    (LIST_MAX ' + LIST_MAX + ' 에서 멈춥니다)');
      break;
    }
    console.log('    · 목록 ' + out.length + '건까지 받았습니다');
    await sleep(700);
  }
  /* 같은 번호가 두 번 오는 일을 막습니다 */
  return [...new Set(out)];
}

function detailQuery(qids) {
  const vs = qids.map(q => 'wd:' + q).join(' ');
  return `
SELECT ?item ?nameKo ?nameEn ?inception ?countryKo ?countryEn ?cityKo ?cityEn
       ?website ?image ?descKo ?descEn
       (GROUP_CONCAT(DISTINCT ?genL; separator=", ") AS ?gen) WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item rdfs:label ?nameKo. FILTER(LANG(?nameKo)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn. FILTER(LANG(?nameEn)="en") }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P17 ?country.
    OPTIONAL { ?country rdfs:label ?countryKo. FILTER(LANG(?countryKo)="ko") }
    OPTIONAL { ?country rdfs:label ?countryEn. FILTER(LANG(?countryEn)="en") } }
  OPTIONAL { ?item wdt:P159 ?hq.
    OPTIONAL { ?hq rdfs:label ?cityKo. FILTER(LANG(?cityKo)="ko") }
    OPTIONAL { ?hq rdfs:label ?cityEn. FILTER(LANG(?cityEn)="en") } }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P154 ?image. }
  OPTIONAL { ?item wdt:P136 ?g0. ?g0 rdfs:label ?genL. FILTER(LANG(?genL)="en") }
  OPTIONAL { ?item schema:description ?descKo. FILTER(LANG(?descKo)="ko") }
  OPTIONAL { ?item schema:description ?descEn. FILTER(LANG(?descEn)="en") }
}
GROUP BY ?item ?nameKo ?nameEn ?inception ?countryKo ?countryEn ?cityKo ?cityEn
         ?website ?image ?descKo ?descEn`;
}

// 한 분류를 다 훑습니다. 실패한 묶음은 건너뛰고 나머지를 계속합니다.
async function collectClass(cls) {
  let qids = [];
  try {
    qids = await listAll(cls);
  } catch (e) {
    console.log('  · ' + cls.type + ' 목록 조회 실패 ·', String(e.message).slice(0, 70));
    return [];
  }
  console.log('  · ' + cls.type + ' · 목록 ' + qids.length + '건 · 상세 조회 시작 ('
    + Math.ceil(qids.length / 150) + '묶음)');

  const out = [];
  let failed = 0;
  for (let i = 0; i < qids.length; i += 150) {
    const batch = qids.slice(i, i + 150);
    try {
      const rows = await sparql(detailQuery(batch));
      out.push(...rows);
    } catch (e) {
      failed += batch.length;
      if (isStop(e)) break;                  // 자료원이 막혔으면 남은 묶음을 헛돌지 않습니다
    }
    const done = Math.min(i + 150, qids.length);
    if (done % 3000 === 0 || done === qids.length) {
      console.log('    · 상세 ' + done + '/' + qids.length);
    }
    await sleep(700);
  }
  if (failed) console.log('    (상세를 못 받은 항목 ' + failed + '건 · 다음 실행에서 다시 시도합니다)');
  return out;
}

function toRow(b, type) {
  const nameKo = clean(val(b, 'nameKo'));
  const nameEn = clean(val(b, 'nameEn'));
  const title = nameKo || nameEn;
  if (!title) return null;

  const country = clean(val(b, 'countryKo')) || clean(val(b, 'countryEn'));
  let city = clean(val(b, 'cityKo')) || clean(val(b, 'cityEn'));
  // 위키데이터에 본부 위치가 자기 자신으로 등록된 경우가 있습니다.
  // 그러면 도시 자리에 기관 이름이 들어가므로 버립니다.
  // (예 · '그리스 · Greek National Opera')
  if (city && title && (city === title || city === nameEn || city === nameKo
      || city.length > 28 || city.indexOf(title) >= 0)) city = null;
  const location = [country, city].filter(Boolean).join(' · ');
  const founded = (val(b, 'inception').match(/(\d{4})/) || [])[1] || null;
  const desc = clean(val(b, 'descKo')) || clean(val(b, 'descEn'));

  return {
    name_ko: nameKo || nameEn,
    name_en: nameEn,
    type,
    location: location || null,
    founded,
    estab_type: null,
    subsidiary: null,
    business: desc,
    field: clean(val(b, 'gen')),
    link_home: clean(val(b, 'website')),
    link_wiki: null,
    logo_url: clean(val(b, 'image')),
    wikidata_id: qidOf(val(b, 'item')),
    source: 'wikidata',
    is_oc: false,
    hidden: false,
  };
}

// ── 판정 ─────────────────────────────────────────────────────
function judge(r) {
  const hay = [r.name_ko, r.name_en, r.business, r.field].filter(Boolean).join(' ');

  // ① 대형 대중음악 그룹은 이름만으로 걸러냅니다
  if (LABEL_DENY.test(hay)) return { ok: false, why: '대중음악 대형사' };

  // ② 널리 알려진 클래식 레이블·출판사는 설명이 부실해도 받습니다.
  //    위키데이터 설명에 classical 이라는 낱말이 없는 곳이 많습니다.
  const known = KNOWN_CLASSIC.test([r.name_ko, r.name_en].filter(Boolean).join(' '));

  // ③ 대중음악 장르 표시가 있으면 받지 않습니다 (알려진 곳은 예외)
  if (!known && POP_DENY.test(hay)) return { ok: false, why: '대중음악' };

  // ④ 클래식 근거가 있어야 받습니다.
  //    음반사와 경연은 수가 매우 많아서, 근거 없이 받으면 대중음악이 쏟아집니다.
  if (!known && !CLASSIC_OK.test(hay)) return { ok: false, why: '클래식 근거 없음' };

  // ⑤ 이름 말고 채워진 항목이 둘 이상 있어야 받습니다
  let n = 0;
  if (r.location) n++;
  if (r.founded) n++;
  if (r.link_home) n++;
  if (r.business) n++;
  if (n < 2) return { ok: false, why: '내용 빈약' };

  return { ok: true, why: known ? '알려진 클래식 레이블' : '클래식 근거' };
}

// 위키데이터 분류가 음반사인데 실제로는 극장·단체인 경우가 있습니다.
// 소개문을 보고 유형을 바로잡습니다.
function fixType(r) {
  const hay = [r.name_ko, r.name_en, r.business].filter(Boolean).join(' ');
  if (/opera (house|company)|국립오페라|오페라 극장|theatre|theater/i.test(hay)) return '기타';
  if (/publish|edition|출판|악보/i.test(hay)) return '기타';
  if (/foundation|재단/i.test(hay)) return '재단';
  if (/orchestra|philharmonic|교향악단/i.test(hay)) return '기타';
  return r.type;
}

// ── Supabase ────────────────────────────────────────────────
/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select, extra) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (extra || ''),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
  }
  return out;
}

// ── 차단 목록 ────────────────────────────────────────────────
//  어드민의 '삭제 + 차단' 은 blocklist 표에 위키데이터 번호를 남깁니다.
//  그 목록을 읽지 않으면 지운 항목이 다음 수집에 그대로 되돌아옵니다.
//    2026-07-29 확인 · 수집기 일곱 개가 모두 그 상태였습니다.
async function loadBlocked() {
  try {
    const rows = await sbGetAll('blocklist', 'wikidata_id');
    const set = new Set();
    for (const r of rows || []) if (r && r.wikidata_id) set.add(String(r.wikidata_id).trim());
    if (set.size) console.log('■ 차단 목록', set.size, '건 읽음');
    return set;
  } catch (e) {
    console.log('■ 차단 목록을 읽지 못했습니다 · 걸러내지 않고 이어갑니다 ·', String(e.message).slice(0, 60));
    return new Set();
  }
}

async function sbInsert(rows) {
  if (!rows.length) return { ok: 0, dup: 0 };
  const post = (b) => fetch(SUPABASE_URL + '/rest/v1/foundations', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(b),
  });
  const r = await post(rows);
  if (r.ok) return { ok: rows.length, dup: 0 };
  const txt = await r.text();
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0, dup = 0;
    for (const row of rows) {
      const r2 = await post([row]);
      if (r2.ok) { ok++; continue; }
      const t2 = await r2.text();
      if (r2.status === 409 || t2.indexOf('23505') >= 0) { dup++; continue; }
      throw new Error('INSERT ' + r2.status + ' ' + t2);
    }
    return { ok, dup };
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}

async function sbUpdate(id, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/foundations?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text());
}

// 빈 칸만 채웁니다. 사람이 넣은 값은 건드리지 않습니다.
const FILL_COLS = ['name_en', 'location', 'founded', 'business', 'field',
                   'link_home', 'logo_url'];

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 해외 기관·재단 수집기', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');
  console.log('■ 수집 대상 분류 확인');
  await verifyClasses();

  const bag = new Map();     // wikidata_id -> row
  const reasons = {};

  for (const cls of CLASSES) {
    const rows = await collectClass(cls);
    if (!rows.length) { await sleep(2000); continue; }
    let kept = 0;
    for (const b of rows) {
      const row = toRow(b, cls.type);
      if (!row || !row.wikidata_id) continue;
      row.type = fixType(row);          // 극장 · 출판사 · 단체가 음반사로 들어오는 것을 바로잡습니다
      const v = judge(row);
      reasons[v.why] = (reasons[v.why] || 0) + 1;
      if (!v.ok) continue;
      if (!bag.has(row.wikidata_id)) { bag.set(row.wikidata_id, row); kept++; }
    }
    console.log('  · ' + cls.type + ' · 상세 ' + rows.length + '건 · 채택 ' + kept);
    await sleep(2000);
  }

  console.log('■ 판정 결과');
  for (const k of Object.keys(reasons)) console.log('   ' + k + ': ' + reasons[k] + '건');

  const rows = [...bag.values()];
  console.log('■ 수집 후보', rows.length, '건');
  if (!rows.length) { console.log('■ 넣을 것이 없습니다. 종료.'); return; }

  // 기존과 대조. 사람이 넣은 행(wikidata_id 없음)은 아예 보지 않습니다.
  const have = await sbGetAll('foundations', 'id,wikidata_id,' + FILL_COLS.join(','),
                              '&wikidata_id=not.is.null');
  const byQid = new Map();
  for (const h of have) if (h.wikidata_id) byQid.set(String(h.wikidata_id), h);
  const manual = await sbGetAll('foundations', 'id', '&wikidata_id=is.null');

  /* 이미 있는 이름을 모아 둡니다 — 사람이 넣은 것까지 함께 봅니다.
     번호가 없어도 이름이 같으면 두 번 담을 까닭이 없습니다. */
  const haveNames = await sbGetAll('foundations', 'id,name_ko,name_en');
  const nameSet = new Set();
  for (const h of haveNames) {
    if (h.name_ko) nameSet.add(norm(h.name_ko));
    if (h.name_en) nameSet.add(norm(h.name_en));
  }
  const blocked = await loadBlocked();
  console.log('■ 기존 · 수집분', have.length, '건 · 사람이 넣은 것', manual.length, '건(건드리지 않습니다)');

  const fresh = [], patch = [], dupNames = [];
  let blockedOut = 0;
  for (const r of rows) {
    // 어드민에서 '삭제 + 차단' 한 항목은 다시 담지 않습니다.
    if (r.wikidata_id && blocked.has(String(r.wikidata_id))) { blockedOut++; continue; }
    const old = byQid.get(r.wikidata_id);
    if (old) {
      const p = {};
      for (const c of FILL_COLS) if (isEmpty(old[c]) && !isEmpty(r[c])) p[c] = r[c];
      if (Object.keys(p).length) patch.push({ id: old.id, p });
      continue;
    }
    /* ★ 번호는 새것인데 이름이 이미 있는 경우 —
       「EBS」 와 「Ebs」 처럼 표기만 다른 같은 곳입니다. 담지 않습니다.
       무엇을 건너뛰었는지 로그에 남겨 사람이 확인할 수 있게 합니다. */
    const key = norm(r.name_ko) || norm(r.name_en);
    if (key && nameSet.has(key)) {
      dupNames.push(r.name_ko || r.name_en);
      continue;
    }
    if (key) nameSet.add(key);
    fresh.push(r);
  }
  if (dupNames.length) {
    console.log('■ 이름이 이미 있어 건너뜀', dupNames.length, '건'
      + (dupNames.length > 12 ? ' (앞 12건만 적습니다)' : ''));
    console.log('   ' + dupNames.slice(0, 12).join(' · '));
  }

  if (DRY) {
    console.log('■ 시험 실행이므로 저장하지 않습니다.');
    console.log('   새로 넣을 것', fresh.length, '건 · 빈칸 보강', patch.length, '건');
    console.log('   앞 15건:');
    fresh.slice(0, 15).forEach(r => console.log('    ' + (r.name_ko || '').slice(0, 30).padEnd(32)
      + (r.type || '').padEnd(14) + (r.location || '소재지없음').slice(0, 22).padEnd(24)
      + (r.founded || '설립없음')));
    return;
  }

  let ins = 0, dup = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const r = await sbInsert(fresh.slice(i, i + 200));
    ins += r.ok; dup += r.dup;
  }
  console.log('■ 신규 저장', ins, '건' + (dup ? ' · 이미 있어 건너뜀 ' + dup + '건' : ''));
  if (blockedOut) console.log('■ 차단 목록 제외', blockedOut, '건');

  let up = 0;
  for (const { id, p } of patch) { await sbUpdate(id, p); up++; }
  console.log('■ 빈칸 보강', up, '건');

  const t = await fetch(SUPABASE_URL + '/rest/v1/foundations?select=id&limit=1',
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = t.headers.get('content-range') || '';
  console.log('■ 완료 · 기관·재단 총', (cr.split('/')[1] || '?'), '곳');
}

main().catch(e => {
  // 자료원이 막혀 멈춘 것은 실패가 아닙니다.
  // 모은 것은 이미 저장됐고 못 채운 몫은 다음 예약 실행이 받아옵니다.
  if (isStop(e)) {
    console.log('■ 여기까지 · ' + e.message);
    console.log('■ 다음 예약 실행에서 이어서 받아옵니다.');
    return;
  }
  console.error('■ 실패:', e);
  process.exit(1);
});
