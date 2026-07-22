// ============================================================
// OPUSCLAM 공연장(venues) 자동 수집기
// - 소스: 위키데이터(SPARQL)
// - 원칙: ① 신규 추가  ② 기존은 '빈 칸만' 보강  ③ 사람이 채운 값은 안 건드림
// - 실행: GitHub Actions (주 1회) 또는 수동. Node 18+ (fetch 내장)
// - 필요 환경변수(Secrets): SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';

// 수집 대상 클래스(위키데이터) → 오퍼스클램 유형명
const CLASSES = [
  { qid: 'Q1060829', type: '콘서트홀' },   // concert hall
  { qid: 'Q153562',  type: '오페라하우스' }, // opera house
  { qid: 'Q1319496', type: '공연장' },      // music venue
];

// ---------- 위키데이터 SPARQL ----------
function buildQuery(clsQid) {
  return `
SELECT ?item ?nameKo ?nameEn ?inception ?capacity ?countryKo ?countryEn ?cityKo ?cityEn ?operatorKo ?operatorEn ?image ?koArticle ?enArticle WHERE {
  ?item wdt:P31 wd:${clsQid} .
  OPTIONAL { ?item rdfs:label ?nameKo. FILTER(LANG(?nameKo)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn. FILTER(LANG(?nameEn)="en") }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P1083 ?capacity. }
  OPTIONAL { ?item wdt:P17 ?country.
    OPTIONAL { ?country rdfs:label ?countryKo. FILTER(LANG(?countryKo)="ko") }
    OPTIONAL { ?country rdfs:label ?countryEn. FILTER(LANG(?countryEn)="en") } }
  OPTIONAL { ?item wdt:P131 ?city.
    OPTIONAL { ?city rdfs:label ?cityKo. FILTER(LANG(?cityKo)="ko") }
    OPTIONAL { ?city rdfs:label ?cityEn. FILTER(LANG(?cityEn)="en") } }
  OPTIONAL { ?item wdt:P137 ?operator.
    OPTIONAL { ?operator rdfs:label ?operatorKo. FILTER(LANG(?operatorKo)="ko") }
    OPTIONAL { ?operator rdfs:label ?operatorEn. FILTER(LANG(?operatorEn)="en") } }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
  OPTIONAL { ?enArticle schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
}
LIMIT 3000`;
}

async function sparql(query, tries = 3) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('SPARQL ' + res.status);
      const j = await res.json();
      return j.results.bindings;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
  return [];
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (uri) => uri.split('/').pop();

// ---------- 위키데이터 → venues 행으로 변환/병합 ----------
function toRow(b, type) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null; // 이름 없으면 스킵

  const country = val(b, 'countryKo') || val(b, 'countryEn');
  const city    = val(b, 'cityKo')    || val(b, 'cityEn');
  const location = [country, city].filter(Boolean).join(' · ');

  const inc = val(b, 'inception');
  const opened = (inc.match(/(\d{4})/) || [])[1] || '';

  const capRaw = val(b, 'capacity');
  const capNum = capRaw ? parseInt(capRaw, 10) : NaN;
  const seats = Number.isFinite(capNum) && capNum > 0 ? capNum.toLocaleString('en-US') + '석' : '';

  const operator = val(b, 'operatorKo') || val(b, 'operatorEn') || '';
  const logo_url = val(b, 'image') || '';
  const link_wiki = val(b, 'koArticle') || val(b, 'enArticle') || '';

  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    type, location, opened, seats, operator, logo_url, link_wiki,
    source: 'auto',
  };
}

// 여러 행(OPTIONAL로 중복)에서 항목별로 비지 않은 값 우선 병합
function mergeById(map, row) {
  if (!row) return;
  const cur = map.get(row.wikidata_id);
  if (!cur) { map.set(row.wikidata_id, row); return; }
  for (const k of Object.keys(row)) {
    if (!cur[k] && row[k]) cur[k] = row[k];
  }
}

// ---------- Supabase REST ----------
const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};
async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: H });
  if (!res.ok) throw new Error('GET ' + path + ' → ' + res.status + ' ' + await res.text());
  return res.json();
}
async function sbInsert(rows) {
  if (!rows.length) return;
  const res = await fetch(SUPABASE_URL + '/rest/v1/venues', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error('INSERT → ' + res.status + ' ' + await res.text());
}
async function sbUpdate(id, patch) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/venues?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('UPDATE ' + id + ' → ' + res.status + ' ' + await res.text());
}

// 보강 대상 컬럼(빈 칸만 채움 / 사람이 채운 값 보호)
const FILL_COLS = ['name_en', 'type', 'location', 'opened', 'seats', 'operator', 'logo_url', 'link_wiki'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

async function main() {
  console.log('■ 공연장 수집 시작', new Date().toISOString());

  // 1) 위키데이터에서 수집
  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.type, '(' + c.qid + ')');
    const rows = await sparql(buildQuery(c.qid));
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.type));
    await sleep(1500);
  }
  console.log('■ 수집된 고유 공연장:', collected.size, '곳');

  // 2) 기존 DB 로드
  const existing = await sbGet('venues?select=id,wikidata_id,name_ko,name_en,type,location,opened,seats,operator,logo_url,link_wiki,sort_no');
  const byWid = new Map();
  let maxSort = 0;
  for (const r of existing) {
    if (r.wikidata_id) byWid.set(r.wikidata_id, r);
    if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no;
  }
  console.log('■ 기존 venues:', existing.length, '행 (wikidata 매칭됨', byWid.size, ')');

  // 3) 신규 / 보강 분류
  const toInsert = [];
  let updated = 0, skipped = 0;
  for (const row of collected.values()) {
    const cur = byWid.get(row.wikidata_id);
    if (!cur) {
      toInsert.push({ ...row, sort_no: ++maxSort });
    } else {
      const patch = {};
      for (const k of FILL_COLS) {
        if (isEmpty(cur[k]) && !isEmpty(row[k])) patch[k] = row[k];
      }
      if (Object.keys(patch).length) { await sbUpdate(cur.id, patch); updated++; }
      else skipped++;
    }
  }

  // 4) 신규 일괄 삽입(100개씩)
  for (let i = 0; i < toInsert.length; i += 100) {
    await sbInsert(toInsert.slice(i, i + 100));
  }

  console.log('■ 완료 — 신규추가:', toInsert.length, '· 빈칸보강:', updated, '· 변경없음:', skipped);
}

main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
