// ============================================================
// OPUSCLAM 공연장(venues) 자동 수집기 (v3·충실도 우선)
//  - 소스: 위키데이터(콘서트홀·오페라하우스) + 한국어 위키백과 소개
//  - 항목: 유형·소재지·개관·좌석·운영주체·상주단체·홈페이지·이미지·위키·소개
//  - 충실도 컷오프(B): 실질 정보 없는 '이름만' 항목 제외
//  - 충실도 순 정렬 · 신규추가/빈칸보강/사람값 보호/중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';
const CLASSES = [
  { qid: 'Q1060829', type: '콘서트홀' },
  { qid: 'Q153562',  type: '오페라하우스' },
];

function buildQuery(clsQid) {
  return `
SELECT ?item ?nameKo ?nameEn ?country ?inception ?capacity ?countryKo ?countryEn ?cityKo ?cityEn ?operatorKo ?operatorEn ?image ?website ?residentKo ?residentEn ?koArticle ?enArticle WHERE {
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
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P466 ?occupant.
    OPTIONAL { ?occupant rdfs:label ?residentKo. FILTER(LANG(?residentKo)="ko") }
    OPTIONAL { ?occupant rdfs:label ?residentEn. FILTER(LANG(?residentEn)="en") } }
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
async function wikiFetch(host, title) {
  if (!title) return { text: '', image: '' };
  const u = 'https://' + host + '/w/api.php?format=json&action=query&prop=extracts%7Cpageimages'
    + '&explaintext=1&exchars=1800&piprop=thumbnail&pithumbsize=480&redirects=1&titles=' + title;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) return { text: '', image: '' };
    const j = await r.json();
    const pages = j && j.query && j.query.pages;
    if (!pages) return { text: '', image: '' };
    const pg = Object.values(pages)[0] || {};
    return { text: (pg.extract || '').trim(), image: (pg.thumbnail && pg.thumbnail.source) || '' };
  } catch (e) { return { text: '', image: '' }; }
}
async function wikiEnrich(koUrl, enUrl) {
  if (koUrl && koUrl.indexOf('ko.wikipedia.org') >= 0) {
    const t = koUrl.split('/wiki/')[1] || '';
    if (t) { const w = await wikiFetch('ko.wikipedia.org', t); if (w.text || w.image) return w; }
  }
  if (enUrl && enUrl.indexOf('en.wikipedia.org') >= 0) {
    const t = enUrl.split('/wiki/')[1] || '';
    if (t) { const w = await wikiFetch('en.wikipedia.org', t); return w; }
  }
  return { text: '', image: '' };
}

function toRow(b, type) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null;
  const country = val(b, 'countryKo') || val(b, 'countryEn');
  const city = val(b, 'cityKo') || val(b, 'cityEn');
  const location = [country, city].filter(Boolean).join(' · ');
  const opened = (val(b, 'inception').match(/(\d{4})/) || [])[1] || '';
  const capNum = parseInt(val(b, 'capacity'), 10);
  const seats = Number.isFinite(capNum) && capNum > 0 ? capNum.toLocaleString('en-US') + '석' : '';
  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    type, location, opened, seats,
    operator: val(b, 'operatorKo') || val(b, 'operatorEn') || '',
    resident: val(b, 'residentKo') || val(b, 'residentEn') || '',
    logo_url: val(b, 'image') || '',
    link_home: val(b, 'website') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    _koWiki: val(b, 'koArticle') || '',
    _enWiki: val(b, 'enArticle') || '',
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
  ['seats', 'opened', 'operator', 'resident', 'logo_url', 'link_home'].forEach(k => { if (r[k] && String(r[k]).trim()) c++; });
  return c;
}
const bioOK = (r) => (r.description || '').trim().length >= 150;
function keep(r) { return bioOK(r) || substanceCount(r) >= 4; }
function richness(r) {
  let sc = 0;
  if ((r.description || '').trim().length >= 150) sc += 2;
  if (r.resident && String(r.resident).trim()) sc += 2;
  if (r.operator && String(r.operator).trim()) sc += 1;
  if (r.seats && String(r.seats).trim()) sc += 1;
  if (r.opened && String(r.opened).trim()) sc += 1;
  if (r.link_home && String(r.link_home).trim()) sc += 1;
  if (r.logo_url && String(r.logo_url).trim()) sc += 1;
  if (r.location && String(r.location).trim()) sc += 1;
  if (r.source && r.source !== 'auto') sc += 6;
  return sc;
}

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(p) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + p, { headers: H }); if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text()); return r.json(); }
async function sbInsert(rows) { if (!rows.length) return; const r = await fetch(SUPABASE_URL + '/rest/v1/venues', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error('INSERT ' + r.status + ' ' + await r.text()); }
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/venues?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'type', 'location', 'opened', 'seats', 'operator', 'resident', 'logo_url', 'link_home', 'link_wiki', 'description'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function sbGetAll(table, select) {
  // Supabase 1000행 제한 우회: Range 헤더로 전체 페이지 읽기
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select,
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < STEP) break;
    from += STEP;
  }
  return out;
}
async function rerank() {
  const rows = await sbGetAll('venues', 'id,source,description,resident,operator,seats,opened,link_home,logo_url,location,sort_no');
  rows.sort((a, b) => richness(a) - richness(b));
  let n = 0, done = 0;
  for (const r of rows) { n++; if (r.sort_no !== n) { await sbUpdate(r.id, { sort_no: n }); done++; } }
  console.log('■ 재정렬(빈약한 항목 뒤로):', rows.length, '행 · sort_no 갱신', done);
}

async function main() {
  console.log('■ 공연장 수집 시작(v3·충실도 우선)', new Date().toISOString());
  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.type);
    const rows = await sparql(buildQuery(c.qid));
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.type));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '곳');

  const withWiki = [...collected.values()].filter(r => r._koWiki || r._enWiki);
  console.log('  · 위키백과 본문·대표이미지 보강 중(한국어 우선, 없으면 영어)…', withWiki.length, '곳');
  let bc = 0, ic = 0;
  for (const r of withWiki) {
    const w = await wikiEnrich(r._koWiki, r._enWiki);
    if (w.text) { r.description = w.text.slice(0, 1200); bc++; }
    if (w.image && !r.logo_url) { r.logo_url = w.image; ic++; }
    await sleep(120);
  }
  console.log('    → 소개 보강', bc, '곳 · 대표이미지 보강', ic, '곳');

  const kept = [...collected.values()].filter(keep);
  console.log('■ 충실도 통과:', kept.length, '곳 (제외', collected.size - kept.length, ')');

  const existing = await sbGet('venues?select=id,wikidata_id,name_ko,name_en,type,location,opened,seats,operator,resident,logo_url,link_home,link_wiki,description,sort_no');
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존 venues:', existing.length, '행');

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
