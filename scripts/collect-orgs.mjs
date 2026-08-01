// ============================================================
// OPUSCLAM 음악단체(orgs) 자동 수집기 (v2·충실도 우선)
//  - 소스: 위키데이터(오케스트라·합창단 하위 포함) + 한국어 위키백과 소개
//  - 항목: 유형·소재지·창단·지휘자(대표)·홈페이지·이미지·위키·소개
//  - 충실도 컷오프(B) · 충실도 정렬 · 신규추가/빈칸보강/사람값 보호/중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';
const CLASSES = [
  { anchor: 'Q42998',  type: '오케스트라' },
  { anchor: 'Q131186', type: '합창단' },
];

/* ① 번호만 받는 가벼운 질의 */
function buildIdQuery(anchor) {
  return `
SELECT DISTINCT ?item WHERE { ?item wdt:P31/wdt:P279* wd:${anchor} . }`;
}

/* ② 번호를 못박고 상세를 받는 질의 (원래 질의와 같은 칸을 돌려줍니다) */
function buildDetailQuery(qids) {
  return buildQuery(null, qids);
}

function buildQuery(anchor, qids) {
  const scope = qids
    ? 'VALUES ?item { ' + qids.map(q => 'wd:' + q).join(' ') + ' }'
    : '?item wdt:P31/wdt:P279* wd:' + anchor + ' .';
  return `
SELECT ?item ?nameKo ?nameEn ?country ?countryKo ?countryEn ?cityKo ?cityEn ?inception ?conductorKo ?conductorEn ?venueKo ?venueEn ?image ?website ?koArticle ?enArticle WHERE {
  ${scope}
  OPTIONAL { ?item rdfs:label ?nameKo. FILTER(LANG(?nameKo)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn. FILTER(LANG(?nameEn)="en") }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P17 ?country.
    OPTIONAL { ?country rdfs:label ?countryKo. FILTER(LANG(?countryKo)="ko") }
    OPTIONAL { ?country rdfs:label ?countryEn. FILTER(LANG(?countryEn)="en") } }
  OPTIONAL { ?item wdt:P159 ?hq.
    OPTIONAL { ?hq rdfs:label ?cityKo. FILTER(LANG(?cityKo)="ko") }
    OPTIONAL { ?hq rdfs:label ?cityEn. FILTER(LANG(?cityEn)="en") } }
  OPTIONAL { ?item wdt:P3300 ?conductor.
    OPTIONAL { ?conductor rdfs:label ?conductorKo. FILTER(LANG(?conductorKo)="ko") }
    OPTIONAL { ?conductor rdfs:label ?conductorEn. FILTER(LANG(?conductorEn)="en") } }
  OPTIONAL { ?item wdt:P115 ?venue.
    OPTIONAL { ?venue rdfs:label ?venueKo. FILTER(LANG(?venueKo)="ko") }
    OPTIONAL { ?venue rdfs:label ?venueEn. FILTER(LANG(?venueEn)="en") } }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
  OPTIONAL { ?enArticle schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? u.split('/').pop() : '';
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();

async function sparql(query, tries = 3) {
  const url = 'https://query.wikidata.org/sparql';
  for (let i = 0; i < tries; i++) {
    try {
      /* ★ POST 로 보냅니다 — 질의가 길면 주소에 담기가 위험합니다 */
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: 'format=json&query=' + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('SPARQL ' + res.status);

      /* ★ 바로 json() 하지 않고 글로 먼저 읽습니다.
         위키데이터는 60초 제한에 걸리면 결과를 끊고 그 뒤에 오류 문구를
         덧붙입니다. 그러면 json() 이 「JSON 뒤에 엉뚱한 글자」 라고만 하고
         무슨 일이 있었는지 알려 주지 않습니다. */
      const text = await res.text();
      try {
        return JSON.parse(text).results.bindings;
      } catch (pe) {
        const tail = text.slice(-300).replace(/\s+/g, ' ');
        const timedOut = /timeout|TimeoutException|QueryTimeout/i.test(text.slice(-2000));
        const msg = 'SPARQL 응답을 읽지 못했습니다'
          + (timedOut ? ' (위키데이터 시간 초과로 결과가 끊겼습니다)' : '')
          + ' · 길이 ' + text.length + ' · 끝부분: ' + tail;
        if (timedOut && i < tries - 1) { console.log('    ' + msg); await sleep(5000 * (i + 1)); continue; }
        throw new Error(msg);
      }
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
  return [];
}

/* ★ 두 단계로 나눠 받습니다 — 이것이 이번 실패의 해결입니다.

   예전에는 「분류 전체 + OPTIONAL 열 덩이」 를 한 번에 물어봤습니다.
   OPTIONAL 이 곱해지며 결과가 3MB를 넘고, 위키데이터의 60초 제한에 걸려
   결과가 끊겼습니다. 재시도해도 같은 자리에서 또 끊깁니다 —
   우연이 아니라 질의가 무거운 것이 원인이기 때문입니다.

   ① 먼저 <b>번호(QID)만</b> 받습니다. 가볍고 빠릅니다.
   ② 그 번호를 CHUNK 개씩 묶어 상세를 받습니다.
      VALUES ?item { wd:Q1 wd:Q2 … } 로 대상을 못박으면
      위키데이터가 훑을 범위가 작아져 시간 초과가 나지 않습니다.

   이 방식은 이미 인물DB·음악학교 수집기가 보조 질의에 쓰던 것입니다. */
const CHUNK_QID = 120;

async function fetchClassRows(anchor, idQuery, detailQuery) {
  const ids = await sparql(idQuery(anchor));
  const qids = [...new Set(ids.map(b => qidOf(val(b, 'item'))))].filter(Boolean);
  console.log('    → 대상', qids.length, '건 · ' +
    Math.ceil(qids.length / CHUNK_QID) + '묶음으로 나눠 받습니다');

  const out = [];
  for (let i = 0; i < qids.length; i += CHUNK_QID) {
    const slice = qids.slice(i, i + CHUNK_QID);
    out.push(...await sparql(detailQuery(slice)));
    const done = Math.min(i + CHUNK_QID, qids.length);
    if (done % (CHUNK_QID * 5) === 0 || done === qids.length) {
      console.log('    · ' + done + '/' + qids.length);
    }
    await sleep(400);
  }
  return out;
}

async function wikiExtract(url) {
  if (!url || url.indexOf('ko.wikipedia.org') < 0) return '';
  const title = (url.split('/wiki/')[1] || '');
  if (!title) return '';
  try {
    const r = await fetch('https://ko.wikipedia.org/api/rest_v1/page/summary/' + title, { headers: { 'User-Agent': UA } });
    if (!r.ok) return '';
    const j = await r.json();
    return (j.extract || '').trim();
  } catch (e) { return ''; }
}

function toRow(b, type) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null;
  const country = val(b, 'countryKo') || val(b, 'countryEn');
  const city = val(b, 'cityKo') || val(b, 'cityEn');
  const location = [country, city].filter(Boolean).join(' · ');
  const founded = (val(b, 'inception').match(/(\d{4})/) || [])[1] || '';
  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    type, location, founded,
    leader: val(b, 'conductorKo') || val(b, 'conductorEn') || '',
    home_venue: val(b, 'venueKo') || val(b, 'venueEn') || '',
    logo_url: val(b, 'image') || '',
    link_home: val(b, 'website') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    description: '',
    source: 'auto',
    _domestic: qidOf(val(b, 'country')) === KR_QID || country === '대한민국' || country === 'South Korea',
  };
}
function mergeById(map, row) {
  if (!row) return;
  const cur = map.get(row.wikidata_id);
  if (!cur) { map.set(row.wikidata_id, row); return; }
  for (const k of Object.keys(row)) {
    if (typeof row[k] === 'boolean') { if (row[k]) cur[k] = true; }
    else if (!cur[k] && row[k]) cur[k] = row[k];
  }
}

function substanceCount(r) {
  let c = 0;
  ['founded', 'leader', 'home_venue', 'logo_url', 'link_home'].forEach(k => { if (r[k] && String(r[k]).trim()) c++; });
  return c;
}
const bioOK = (r) => (r.description || '').trim().length >= 150;
function keep(r) { return bioOK(r) || substanceCount(r) >= 3; }
function richness(r) {
  let sc = 0;
  if ((r.description || '').trim().length >= 150) sc += 2;
  if (r.leader && String(r.leader).trim()) sc += 1;
  if (r.home_venue && String(r.home_venue).trim()) sc += 1;
  if (r.founded && String(r.founded).trim()) sc += 1;
  if (r.logo_url && String(r.logo_url).trim()) sc += 1;
  if (r.link_home && String(r.link_home).trim()) sc += 1;
  if (r.location && String(r.location).trim()) sc += 1;
  if (r.source && r.source !== 'auto') sc += 6;
  return sc;
}

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(p) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + p, { headers: H }); if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text()); return r.json(); }
/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select, { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json(); out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
  }
  return out;
}

// ── 차단 목록 ────────────────────────────────────────────────
//  어드민의 '삭제 + 차단' 은 blocklist 표에 위키데이터 번호를 남깁니다.
//  그런데 이 자동 수집기들은 그 목록을 읽지 않았습니다.
//  어드민 화면의 수동 수집(admin.html)에는 있던 처리가
//  스크립트로 옮길 때 빠진 것입니다.
//  그래서 지운 항목이 다음 수집에서 그대로 되돌아왔습니다.
//    2026-07-29 확인 · 현대음악DB 에 홍상수 · 길옥윤 · 이루마 등 19명이 거듭 들어왔습니다.
//  이 함수를 저장 전에 한 번 불러 걸러냅니다.
async function loadBlocked() {
  try {
    const rows = await sbGetAll('blocklist', 'wikidata_id');
    const set = new Set();
    for (const r of rows || []) if (r && r.wikidata_id) set.add(String(r.wikidata_id).trim());
    if (set.size) console.log('■ 차단 목록', set.size, '건 읽음');
    return set;
  } catch (e) {
    // 표가 없어도 수집은 이어갑니다. 다만 걸러지지 않는다는 것을 로그에 남깁니다.
    console.log('■ 차단 목록을 읽지 못했습니다 · 걸러내지 않고 이어갑니다 ·', String(e.message).slice(0, 60));
    return new Set();
  }
}
async function sbInsert(rows) {
  if (!rows.length) return;
  const post = (batch) => fetch(SUPABASE_URL + '/rest/v1/orgs', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(batch)
  });
  const r = await post(rows);
  if (r.ok) return;
  const txt = await r.text();
  // 이미 있는 항목 때문이면 한 건씩 넣어 중복만 건너뜁니다.
  // (on_conflict 방식은 이 환경에서 제약을 인식하지 못해 쓰지 않습니다)
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0, dup = 0;
    for (const row of rows) {
      const r2 = await post([row]);
      if (r2.ok) { ok++; continue; }
      const t2 = await r2.text();
      if (r2.status === 409 || t2.indexOf('23505') >= 0) { dup++; continue; }
      throw new Error('INSERT ' + r2.status + ' ' + t2);
    }
    console.log('    (이미 있는 항목 ' + dup + '건 건너뜀 · ' + ok + '건 저장)');
    return;
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/orgs?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'type', 'location', 'founded', 'leader', 'home_venue', 'logo_url', 'link_home', 'link_wiki', 'description'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function rerank() {
  const rows = await sbGetAll('orgs', 'id,source,description,leader,founded,home_venue,logo_url,link_home,location,sort_no');
  rows.sort((a, b) => richness(a) - richness(b));
  let n = 0, done = 0;
  for (const r of rows) { n++; if (r.sort_no !== n) { await sbUpdate(r.id, { sort_no: n }); done++; } }
  console.log('■ 재정렬(빈약한 항목 뒤로):', rows.length, '행 · sort_no 갱신', done);
}

async function main() {
  console.log('■ 음악단체 수집 시작(v2·충실도 우선)', new Date().toISOString());
  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.type);
    const rows = await fetchClassRows(c.anchor, buildIdQuery, buildDetailQuery);
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.type));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '곳');

  const withKo = [...collected.values()].filter(r => (r.link_wiki || '').indexOf('ko.wikipedia.org') >= 0);
  console.log('  · 한국어 위키백과 소개 보강 중…', withKo.length, '곳');
  let bc = 0;
  for (const r of withKo) { const ex = await wikiExtract(r.link_wiki); if (ex) { r.description = ex.slice(0, 500); bc++; } await sleep(120); }
  console.log('    → 소개 보강', bc, '곳');

  const kept = [...collected.values()].filter(keep);
  console.log('■ 충실도 통과:', kept.length, '곳 (제외', collected.size - kept.length, ')');

  const existing = await sbGetAll('orgs', 'id,wikidata_id,name_ko,name_en,type,location,founded,leader,home_venue,logo_url,link_home,link_wiki,description,sort_no');
  const blocked = await loadBlocked();
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존 orgs:', existing.length, '행');

  const toIns = []; let updated = 0, skipped = 0, dupName = 0;
  let blockedOut = 0;
  for (const row of kept) {
    // 어드민에서 '삭제 + 차단' 한 항목은 다시 담지 않습니다.
    //   이 검사가 없어 지운 것이 매주 되돌아왔습니다.
    if (row.wikidata_id && blocked.has(String(row.wikidata_id))) { blockedOut++; continue; }
    const cur = byWid.get(row.wikidata_id);
    if (cur) { const patch = {}; for (const k of FILL_COLS) if (isEmpty(cur[k]) && !isEmpty(row[k])) patch[k] = row[k]; if (Object.keys(patch).length) { await sbUpdate(cur.id, patch); updated++; } else skipped++; continue; }
    if (nameSet.has(norm(row.name_ko))) { dupName++; continue; }
    nameSet.add(norm(row.name_ko));
    toIns.push(Object.assign(strip(row), { sort_no: ++maxSort }));
  }
  for (let i = 0; i < toIns.length; i += 100) await sbInsert(toIns.slice(i, i + 100));
  console.log('■ 신규추가:', toIns.length, '· 빈칸보강:', updated, '· 변경없음:', skipped,
              '· 이름중복스킵:', dupName, '· 차단목록제외:', blockedOut);

  await rerank();
  console.log('■ 완료');
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
