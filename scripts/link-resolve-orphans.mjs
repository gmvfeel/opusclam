// ============================================================
// OPUSCLAM 이름만 있는 관계 해소 (v1)
//
//  entity_links 에는 대상이 우리 DB 에 없어 이름만 적힌 관계가 있습니다.
//    alumnus_of  3,109건 · 학교 1,713곳 중 미등록분
//    fellow_of   2,059건 · 학술원 635곳 (전부 미등록)
//  화면에는 'DB 미등록' 으로 표시되고 누를 수 없습니다.
//
//  다행히 모든 관계에 위키데이터 번호(to_ref)가 함께 저장돼 있습니다.
//  그 번호로 대상을 받아와 DB 에 넣고 관계를 이어줍니다.
//  이름으로 찾지 않으므로 동명이인 문제가 없습니다.
//
//  담는 기준
//    학교(alumnus_of)  · 음악원부터 종합대학까지 모두 담고 분류로 나눕니다.
//                        하버드 출신 음악학자 54명의 연결을 살리기 위함입니다.
//    학술원(fellow_of) · 음악 관련만 담습니다.
//                        미술 학술원 · 프리메이슨은 클래식 포털의 자료가 아닙니다.
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            ORPHAN_DRY=1 이면 저장하지 않고 결과만 보여줍니다
//            ORPHAN_ONLY=school 또는 fellow 로 한쪽만 처리할 수 있습니다
// ============================================================

// 바깥 자료원 호출은 공용 모듈이 담당합니다 · scripts/lib/http.mjs
//   429 대기 상한 90초 · 실행 예산 25분 · 막히면 모은 것까지 저장하고 정상 종료합니다.
//   이 정책을 고치려면 http.mjs 한 곳만 고치면 모든 수집기에 반영됩니다.
import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

import { readJson } from './lib/json.mjs';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1.1';   // 공용 http 모듈 적용판 (로그에서 새 코드인지 구분하는 표시)
const DRY  = process.env.ORPHAN_DRY === '1';
const ONLY = (process.env.ORPHAN_ONLY || '').trim();
// 인물이 이만큼 이상 붙은 곳만 담습니다.
// 1명만 연결된 학교 수백 곳을 담으면 DB 가 이름만 있는 항목으로 뒤덮입니다.
const MIN_PERSONS = Number(process.env.ORPHAN_MIN || 2);
const UA   = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const SPARQL = 'https://query.wikidata.org/sparql';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// ── 판정 규칙 ────────────────────────────────────────────────
// 학교 분류 · 이름을 보고 정합니다. 위에서부터 처음 맞는 것을 씁니다.
const SCHOOL_CAT = [
  [/conservator|conservatoire|conservatorio|musikhochschule|hochschule für musik|음악원|academy of music|academia de música|음악아카데미/i, '음악원'],
  [/college of music|school of music|음악대학|faculty of music|음대/i,                      '음악대학'],
  [/university of the arts|arts university|예술대학|academy of (fine )?arts|예술종합/i,       '예술대학'],
  // 예술고는 '예술' 이 들어간 곳만 봅니다.
  // 독일 Gymnasium 은 인문계 고등학교이고 Schule 는 그냥 학교입니다.
  // 이걸 예술고로 담았더니 394곳이 잘못 분류됐습니다.
  [/예술고|arts (high )?school|music gymnasium|musikgymnasium|conservatory school/i,        '예술고등학교'],
  [/graduate school|대학원/i,                                                               '대학원'],
  [/universit|대학교|université|universität|università|universidad/i,                        '종합대학'],
  [/gymnasium|\bschule\b|고등학교|high school|lycée|secondary school|grammar school/i,       '기타'],
  /* ★ 위 줄들에 걸리지 않는 음악·예술 학교를 받아 줍니다.
     Juilliard School · Cornish College of the Arts 처럼
     「음악대학」·「예술대학」 표현이 아닌 이름이 「기타」 로 떨어졌습니다. */
  [/conservator|conservatoire|konservat|konzervat|음악학교|음악원|odeio|musikhochschule|musikschule/i, '음악원'],
  [/college of (the )?arts|school of (the )?arts|arts college|예술학교|art school/i,          '예술대학'],
  [/\bmusic\b|음악|musik|musique|musica|música/i,                                            '음악학교'],
];

/* ★ 음악·예술 학교인지 — 「일반학교」 를 갈라 두는 데 씁니다.

   왜 필요한가
     이 수집기는 「인물의 출신학교로 이름은 적혀 있는데 DB에 없는 곳」 을
     채워 넣습니다. 음악가도 초·중·고를 다녔으니 경기고·이화여고·
     Lycée Masséna·Japan Electronics College 같은 일반 학교가 딸려 옵니다.

   지우지 않고 <b>갈래를 갈라</b> 둡니다.
     · 「인물 → 모교」 는 그 자체로 값이 있습니다(네트워킹)
     · 지워 봐야 다음 달에 또 들어옵니다
     · 갈래가 갈려 있으면 음악학교DB 목록에서 걸러 볼 수 있습니다 */
const MUS_SCHOOL = /음악|예술|성악|기악|국악|무용|합창|관악|현악|피아노|바이올린|music|musik|musique|musica|música|conservator|conservatoire|konservat|konzervat|odeio|philharmon|opera|ballet|choir|choral|kunst|művész|arts/i;

/* 음악과 관련된 학술원만 담습니다 */
const MUSIC_ORG = /music|musik|musique|musica|música|composer|composition|음악|작곡|philharmon|conservator|opera|singing|choral|sound/i;

/* ★ 밴드 · 연주팀 · 듀오는 학술원이 아닙니다.
   fellow_of(학회 회원) 로 들어오면 안 되는 것들입니다 —
   Rasputina(첼로 록밴드) · 스트라토바리우스(메탈밴드) ·
   Igudesman & Joo(음악 코미디 듀오) 가 그렇게 들어왔습니다.
   관계 자체는 값이 있으므로 <b>버리지 않고 소속(member_of)으로 옮깁니다.</b> */
const BAND_LIKE = /\bband\b|밴드|rock group|musical group|musical ensemble|ensemble$|\bduo\b|듀오|\btrio\b|삼중주|\bquartet\b|사중주|\bquintet\b|orchestra$|악단$|그룹$|girl group|boy band|metal band|punk band|jazz group|음악 그룹|연주단|중창단/i;

// 담지 않을 것들 · 미술 · 과학 · 비밀결사 등
const DENY_ORG = /freemason|프리메이슨|fine arts$|미술 아카데미|academy of (painting|sculpture)|masonic/i;

// ── 유틸 ─────────────────────────────────────────────────────
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const clean = (s) => isEmpty(s) ? null : String(s).replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ').trim() || null;
const val = (b, k) => (b[k] && b[k].value) ? String(b[k].value) : '';
const qidOf = (u) => String(u || '').split('/').pop();

const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 5,
});

// ★ 나눠받기에는 <b>순서를 확정해</b> 주어야 합니다.
//
//   왜 필요한가 (2026-08-03 실제로 겪은 일입니다)
//     Range 로 페이지를 나눠 받는데 정렬이 없으면, 데이터베이스는
//     <b>매 페이지마다 다른 순서</b>로 줄 수 있습니다. 그러면 어떤 줄은
//     두 번 오고 어떤 줄은 아예 오지 않습니다.
//
//     어드민 화면에서 인물 9,346명을 그렇게 받다가 같은 인물이 두 번
//     담겼고, 삭제할 때 같은 위키데이터 번호를 두 번 보내
//       ON CONFLICT DO UPDATE command cannot affect row a second time
//     오류가 났습니다. 300명으로 재현해 보니 <b>돌릴 때마</b> 중복 5~8줄,
//     누락 5~8명이 생겼습니다.
//
//     수집기들은 「이미 담긴 항목 목록」 을 이렇게 받아 중복을 피합니다.
//     목록이 새면 <b>이미 있는 것을 또 담거나, 있는 것을 못 알아봅니다.</b>
//
//   기본키는 겹치지 않으므로 정렬에 붙이면 순서가 확정됩니다.
//   blocklist 는 기본키가 wikidata_id 이고, 나머지는 id 입니다.
function orderFor(table) {
  return '&order=' + (table === 'blocklist' ? 'wikidata_id' : 'id') + '.asc';
}

async function sparql(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d.results && d.results.bindings) || [];
}

/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select, extra) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (extra || '') + orderFor(table),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + table + ' ' + r.status + ' ' + await r.text());
    const b = await readJson(r);
    out.push(...b);
    if (!b.length) break;              // 더 없으면 끝
    from += b.length;                     // ★ 받은 만큼만 나아갑니다
    if (from > 60000) break;
  }
  return out;
}

async function sbInsertOne(table, row) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify([row]),
  });
  if (r.ok) { const a = await readJson(r); return (a && a[0]) ? a[0].id : null; }
  const t = await r.text();
  if (r.status === 409 || t.indexOf('23505') >= 0) return 'dup';
  throw new Error('INSERT ' + table + ' ' + r.status + ' ' + t.slice(0, 160));
}

async function sbPatch(table, cond, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + cond, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('PATCH ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

// ── 위키데이터에서 대상 받아오기 ─────────────────────────────
async function fetchEntities(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += 120) {
    const vs = qids.slice(i, i + 120).map(q => 'wd:' + q).join(' ');
    const q = `
SELECT ?item ?nameKo ?nameEn ?inception ?countryKo ?countryEn ?cityKo ?cityEn ?website ?image
       (GROUP_CONCAT(DISTINCT ?typeL; separator=", ") AS ?types)
       ?descKo ?descEn WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item rdfs:label ?nameKo. FILTER(LANG(?nameKo)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn. FILTER(LANG(?nameEn)="en") }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P17 ?c.
    OPTIONAL { ?c rdfs:label ?countryKo. FILTER(LANG(?countryKo)="ko") }
    OPTIONAL { ?c rdfs:label ?countryEn. FILTER(LANG(?countryEn)="en") } }
  OPTIONAL { ?item wdt:P131 ?hq.
    OPTIONAL { ?hq rdfs:label ?cityKo. FILTER(LANG(?cityKo)="ko") }
    OPTIONAL { ?hq rdfs:label ?cityEn. FILTER(LANG(?cityEn)="en") } }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P154 ?image. }
  OPTIONAL { ?item wdt:P31 ?t. ?t rdfs:label ?typeL. FILTER(LANG(?typeL)="en") }
  OPTIONAL { ?item schema:description ?descKo. FILTER(LANG(?descKo)="ko") }
  OPTIONAL { ?item schema:description ?descEn. FILTER(LANG(?descEn)="en") }
}
GROUP BY ?item ?nameKo ?nameEn ?inception ?countryKo ?countryEn ?cityKo ?cityEn
         ?website ?image ?descKo ?descEn`;
    let rows = [];
    try { rows = await sparql(q); }
    catch (e) { if (isStop(e)) break; console.log('  · 위키데이터 조회 실패 · 이 묶음 건너뜀'); await sleep(2000); continue; }
    for (const b of rows) out[qidOf(val(b, 'item'))] = b;
    await sleep(700);
  }
  return out;
}

function toRow(b, kind, fallbackName) {
  const nameKo = clean(val(b, 'nameKo'));
  const nameEn = clean(val(b, 'nameEn'));
  const title = nameKo || nameEn || clean(fallbackName);
  if (!title) return null;

  const country = clean(val(b, 'countryKo')) || clean(val(b, 'countryEn'));
  let city = clean(val(b, 'cityKo')) || clean(val(b, 'cityEn'));
  if (city && (city === title || (city.length > 28))) city = null;
  const location = [country, city].filter(Boolean).join(' · ');
  const founded = (val(b, 'inception').match(/(\d{4})/) || [])[1] || null;
  const desc = clean(val(b, 'descKo')) || clean(val(b, 'descEn'));
  const hay = [title, nameEn, val(b, 'types'), desc].filter(Boolean).join(' ');

  const base = {
    name_ko: nameKo || nameEn || title,
    name_en: nameEn,
    location: location || null,
    founded,
    description: desc,
    link_home: clean(val(b, 'website')),
    logo_url: clean(val(b, 'image')),
    wikidata_id: qidOf(val(b, 'item')),
    source: 'wikidata',
    is_oc: false,
    hidden: false,
  };

  if (kind === 'school') {
    let cat = '기타';
    for (const [re, name] of SCHOOL_CAT) if (re.test(hay)) { cat = name; break; }
    /* ★ 음악·예술 낱말이 없는데 갈래가 「기타」 로 떨어진 것은
       일반 고등학교·전문학교입니다. 「일반학교」 로 갈라 둡니다.
       (종합대학·대학원은 그대로 둡니다 — 음악대학을 품은 대학이 많습니다) */
    if (cat === '기타' && !MUS_SCHOOL.test(hay)) cat = '일반학교';
    return Object.assign(base, { category: cat });
  }
  // 학술원 · 기관·재단DB 로 갑니다.
  // '제2빈악파' · '프랑스 6인조' 처럼 유파 · 작곡가 모임은 기관이 아니므로
  // 갈래를 '기타' 로 두어 협회와 섞이지 않게 합니다.
  const isSchool = /\bschool\b|악파|\bles six\b|6인조|group of|circle of|\bgroup\b/i.test(hay)
                && !/school of music|music school|conservator/i.test(hay);
  return Object.assign(base, {
    type: isSchool ? '기타' : '협회',
    estab_type: isSchool ? '유파 · 모임' : '학술단체',
    field: '음악 · 예술',
  });
}

/* 밴드·연주팀을 음악단체DB(orgs) 행으로 만듭니다.
   기관·재단 행과 칸이 다르므로 따로 둡니다. */
function toOrgRow(b, label) {
  const nameKo = clean(val(b, 'nameKo')) || clean(label);
  const nameEn = clean(val(b, 'nameEn'));
  if (!nameKo && !nameEn) return null;
  return {
    name_ko: nameKo || nameEn,
    name_en: nameEn,
    org_type: '연주팀 · 밴드',
    description: clean(val(b, 'descKo')) || clean(val(b, 'descEn')) || null,
    wikidata_id: qidOf(val(b, 'item')),
    source: 'wikidata',
    is_oc: false,
    hidden: false,
  };
}

function musicalOrg(row, types) {
  const hay = [row.name_ko, row.name_en, row.description, types].filter(Boolean).join(' ');
  if (DENY_ORG.test(hay)) return false;
  return MUSIC_ORG.test(hay);
}

/* 밴드·연주팀인가 — 학술원이 아니라 소속(member_of)으로 이어야 합니다 */
function bandLike(row, types) {
  const hay = [row.name_ko, row.name_en, row.description, types].filter(Boolean).join(' ');
  return BAND_LIKE.test(hay);
}

// ── 한 갈래 처리 ─────────────────────────────────────────────
async function run(kind) {
  const rel   = kind === 'school' ? 'alumnus_of' : 'fellow_of';
  const table = kind === 'school' ? 'schools' : 'foundations';
  // 학술원은 foundations 표에 담으므로 to_type 도 'foundation' 이어야 합니다.
  // 'org' 로 두면 엔진이 단체DB(orgs)를 뒤져 엉뚱한 곳을 가리킵니다.
  const toType = kind === 'school' ? 'school' : 'foundation';
  console.log('■ ' + (kind === 'school' ? '학교' : '학술원') + ' 처리 · 관계 ' + rel);

  const links = await sbGetAll('entity_links', 'id,to_ref,to_label',
    '&rel=eq.' + rel + '&to_id=is.null&to_ref=not.is.null');
  if (!links.length) { console.log('  · 이을 것이 없습니다'); return; }

  const byQid = new Map();   // qid -> { label, count }
  for (const l of links) {
    const q = String(l.to_ref || '').trim();
    if (!/^Q\d+$/.test(q)) continue;
    if (!byQid.has(q)) byQid.set(q, { label: l.to_label, n: 0 });
    byQid.get(q).n++;
  }
  console.log('  · 이름만 있는 관계 ' + links.length + '건 · 서로 다른 대상 ' + byQid.size + '곳');

  // 인물 수 분포를 보여줍니다. 기준을 정하는 데 쓰십니다.
  const dist = { '1명': 0, '2명': 0, '3-4명': 0, '5-9명': 0, '10명 이상': 0 };
  for (const v of byQid.values()) {
    if (v.n === 1) dist['1명']++;
    else if (v.n === 2) dist['2명']++;
    else if (v.n <= 4) dist['3-4명']++;
    else if (v.n <= 9) dist['5-9명']++;
    else dist['10명 이상']++;
  }
  console.log('  · 인물 수 분포: ' + Object.keys(dist).map(k => k + ' ' + dist[k] + '곳').join(' · '));
  console.log('  · 기준 ' + MIN_PERSONS + '명 이상만 담습니다 (ORPHAN_MIN 으로 조절)');

  // 이미 DB 에 있는 것은 조회만 해서 이어줍니다
  const have = await sbGetAll(table, 'id,wikidata_id', '&wikidata_id=not.is.null');
  const haveMap = new Map();
  for (const h of have) if (h.wikidata_id) haveMap.set(String(h.wikidata_id), h.id);
  console.log('  · 이미 DB 에 있는 것 ' + haveMap.size + '곳');

  const need = [...byQid.keys()]
    .filter(q => !haveMap.has(q))
    .filter(q => byQid.get(q).n >= MIN_PERSONS);
  console.log('  · 새로 받아올 것 ' + need.length + '곳');

  const ents = need.length ? await fetchEntities(need) : {};

  const fresh = [], bands = [], skipped = { 음악무관: 0, 정보없음: 0 };
  for (const q of need) {
    const b = ents[q];
    if (!b) { skipped.정보없음++; continue; }
    const row = toRow(b, kind, byQid.get(q).label);
    if (!row) { skipped.정보없음++; continue; }
    if (kind === 'fellow') {
      if (!musicalOrg(row, val(b, 'types'))) { skipped.음악무관++; continue; }
      /* ★ 밴드·연주팀·듀오는 학술원이 아닙니다.
         Rasputina(첼로 록밴드) · 스트라토바리우스(메탈밴드) ·
         Igudesman & Joo(음악 코미디 듀오) 가 fellow_of 로 들어왔습니다.
         버리지 않고 <b>음악단체DB(orgs)에 담아 소속(member_of)으로</b> 옮깁니다 —
         「누가 어느 팀에 속했는가」 는 그 자체로 값이 있습니다. */
      if (bandLike(row, val(b, 'types'))) {
        bands.push({ qid: q, row: toOrgRow(b, byQid.get(q).label), n: byQid.get(q).n });
        continue;
      }
    }
    fresh.push({ qid: q, row, n: byQid.get(q).n });
  }
  fresh.sort((a, b) => b.n - a.n);
  bands.sort((a, b) => b.n - a.n);

  console.log('  · 담을 것 ' + fresh.length + '곳'
    + (bands.length ? ' · 밴드·연주팀 ' + bands.length + '곳(음악단체DB로)' : '')
    + (skipped.음악무관 ? ' · 음악과 무관해 건너뜀 ' + skipped.음악무관 + '곳' : '')
    + (skipped.정보없음 ? ' · 자료를 못 받음 ' + skipped.정보없음 + '곳' : ''));
  if (bands.length) {
    console.log('  · 밴드·연주팀 (소속 관계로 옮깁니다):');
    bands.slice(0, 8).forEach(x =>
      console.log('     ' + String(x.row ? (x.row.name_ko || '') : '').slice(0, 34).padEnd(36) + x.n + '명'));
  }

  if (kind === 'school') {
    const cnt = {};
    fresh.forEach(f => { cnt[f.row.category] = (cnt[f.row.category] || 0) + 1; });
    console.log('  · 분류별: ' + Object.keys(cnt).map(k => k + ' ' + cnt[k]).join(' · '));
  }

  console.log('  · 인물이 많이 붙는 곳 10곳:');
  fresh.slice(0, 10).forEach(f => console.log('     '
    + String(f.row.name_ko || '').slice(0, 30).padEnd(32)
    + (kind === 'school' ? String(f.row.category).padEnd(10) : '')
    + f.n + '명'));

  if (DRY) { console.log('  · 시험 실행이므로 저장하지 않습니다'); return; }

  let ins = 0, dup = 0, linked = 0;
  for (const f of fresh) {
    let id = null;
    try { id = await sbInsertOne(table, f.row); }
    catch (e) { console.log('     저장 실패(' + f.qid + ') · ' + String(e.message).slice(0, 80)); continue; }
    if (id === 'dup') {
      // 이미 있으면 그 id 를 찾아 씁니다
      const again = await sbGetAll(table, 'id', '&wikidata_id=eq.' + encodeURIComponent(f.qid));
      id = again.length ? again[0].id : null;
      dup++;
    } else ins++;
    if (!id) continue;
    haveMap.set(f.qid, id);
  }
  console.log('  · 새로 담음 ' + ins + '곳' + (dup ? ' · 이미 있어 이어만 씀 ' + dup + '곳' : ''));

  /* ── 밴드·연주팀 — 음악단체DB에 담고 관계를 소속으로 옮깁니다 ── */
  let bIns = 0, bMoved = 0;
  for (const x of bands) {
    if (!x.row) continue;
    let id = null;
    try { id = await sbInsertOne('orgs', x.row); }
    catch (e) { console.log('     밴드 저장 실패(' + x.qid + ') · ' + String(e.message).slice(0, 70)); continue; }
    if (id === 'dup') {
      const again = await sbGetAll('orgs', 'id', '&wikidata_id=eq.' + encodeURIComponent(x.qid));
      id = again.length ? again[0].id : null;
    } else if (id) bIns++;
    if (!id) continue;
    try {
      /* 학회 회원(fellow_of) → 소속(member_of) 으로 고치고 단체를 가리키게 합니다 */
      await sbPatch('entity_links',
        'rel=eq.fellow_of&to_id=is.null&to_ref=eq.' + encodeURIComponent(x.qid),
        { rel: 'member_of', to_type: 'org', to_id: id });
      bMoved += x.n;
    } catch (e) {
      console.log('     밴드 관계 옮기기 실패(' + x.qid + ') · ' + String(e.message).slice(0, 70));
    }
  }
  if (bands.length) {
    console.log('  · 밴드·연주팀 — 음악단체DB에 ' + bIns + '곳 담음 · 소속 관계로 옮긴 것 ' + bMoved + '건');
  }

  // 관계를 이어줍니다
  for (const [qid, id] of haveMap) {
    if (!byQid.has(qid)) continue;
    try {
      await sbPatch('entity_links',
        'rel=eq.' + rel + '&to_id=is.null&to_ref=eq.' + encodeURIComponent(qid),
        { to_type: toType, to_id: id });
      linked += byQid.get(qid).n;
    } catch (e) {
      console.log('     연결 실패(' + qid + ') · ' + String(e.message).slice(0, 80));
    }
    await sleep(60);
  }
  console.log('  · 이어준 관계 ' + linked + '건');
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 이름만 있는 관계 해소', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');
  if (!ONLY || ONLY === 'school') await run('school');
  if (!ONLY || ONLY === 'fellow') await run('fellow');
  console.log('■ 완료');
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
