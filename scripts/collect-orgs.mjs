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

function buildQuery(anchor) {
  return `
SELECT ?item ?nameKo ?nameEn ?country ?countryKo ?countryEn ?cityKo ?cityEn ?inception ?conductorKo ?conductorEn ?venueKo ?venueEn ?image ?website ?koArticle ?enArticle WHERE {
  ?item wdt:P31/wdt:P279* wd:${anchor} .
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
}
LIMIT 4000`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? u.split('/').pop() : '';
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();

async function sparql(query, tries = 3) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('SPARQL ' + res.status);
      return (await res.json()).results.bindings;
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
  return [];
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
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select, { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json(); out.push(...batch);
    if (batch.length < STEP) break; from += STEP;
  }
  return out;
}
async function sbInsert(rows) { if (!rows.length) return; const r = await fetch(SUPABASE_URL + '/rest/v1/orgs', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error('INSERT ' + r.status + ' ' + await r.text()); }
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
    const rows = await sparql(buildQuery(c.anchor));
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
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존 orgs:', existing.length, '행');

  const toIns = []; let updated = 0, skipped = 0, dupName = 0;
  for (const row of kept) {
    const cur = byWid.get(row.wikidata_id);
    if (cur) { const patch = {}; for (const k of FILL_COLS) if (isEmpty(cur[k]) && !isEmpty(row[k])) patch[k] = row[k]; if (Object.keys(patch).length) { await sbUpdate(cur.id, patch); updated++; } else skipped++; continue; }
    if (nameSet.has(norm(row.name_ko))) { dupName++; continue; }
    nameSet.add(norm(row.name_ko));
    toIns.push(Object.assign(strip(row), { sort_no: ++maxSort }));
  }
  for (let i = 0; i < toIns.length; i += 100) await sbInsert(toIns.slice(i, i + 100));
  console.log('■ 신규추가:', toIns.length, '· 빈칸보강:', updated, '· 변경없음:', skipped, '· 이름중복스킵:', dupName);

  await rerank();
  console.log('■ 완료');
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
