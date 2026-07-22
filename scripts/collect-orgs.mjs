// ============================================================
// OPUSCLAM 음악단체(orgs) 자동 수집기
// - 소스: 위키데이터 · 대상: 오케스트라·합창단(하위 유형 포함)
// - 범위: 국내 전부 · 해외는 한국어에 등재된 단체
// - 원칙: 신규추가 / 빈칸만 보강 / 사람값 보호, 중복방지, 국내 우선 정렬
// - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';

const CLASSES = [
  { anchor: 'Q42998',  type: '오케스트라' },  // orchestra (하위: 교향악단·필하모닉·실내악단 등)
  { anchor: 'Q131186', type: '합창단' },      // choir
];

function buildQuery(anchor) {
  return `
SELECT ?item ?nameKo ?nameEn ?country ?countryKo ?countryEn ?cityKo ?cityEn ?inception ?conductorKo ?conductorEn ?image ?koArticle ?enArticle WHERE {
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
  OPTIONAL { ?item wdt:P18 ?image. }
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

function toRow(b, type) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null;
  const country = val(b, 'countryKo') || val(b, 'countryEn');
  const city = val(b, 'cityKo') || val(b, 'cityEn');
  const location = [country, city].filter(Boolean).join(' · ');
  const founded = (val(b, 'inception').match(/(\d{4})/) || [])[1] || '';
  const leader = val(b, 'conductorKo') || val(b, 'conductorEn') || '';
  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    type, location, founded, leader,
    logo_url: val(b, 'image') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    source: 'auto',
    _domestic: qidOf(val(b, 'country')) === KR_QID || country === '대한민국' || country === 'South Korea',
    _notable: !!nameKo || !!val(b, 'koArticle'),
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

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(p) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + p, { headers: H }); if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text()); return r.json(); }
async function sbInsert(rows) { if (!rows.length) return; const r = await fetch(SUPABASE_URL + '/rest/v1/orgs', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error('INSERT ' + r.status + ' ' + await r.text()); }
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/orgs?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'type', 'location', 'founded', 'leader', 'logo_url', 'link_wiki'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function main() {
  console.log('■ 음악단체 수집 시작', new Date().toISOString());
  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.type, '(' + c.anchor + ')');
    const rows = await sparql(buildQuery(c.anchor));
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.type));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '곳');

  const kept = [...collected.values()].filter(r => r._domestic || r._notable);
  console.log('■ 필터 통과:', kept.length, '곳 (제외', collected.size - kept.length, ')');

  const existing = await sbGet('orgs?select=id,wikidata_id,name_ko,name_en,type,location,founded,leader,logo_url,link_wiki,sort_no');
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존 orgs:', existing.length, '행');

  const insFore = [], insDom = []; let updated = 0, skipped = 0, dupName = 0;
  for (const row of kept) {
    const cur = byWid.get(row.wikidata_id);
    if (cur) { const patch = {}; for (const k of FILL_COLS) if (isEmpty(cur[k]) && !isEmpty(row[k])) patch[k] = row[k]; if (Object.keys(patch).length) { await sbUpdate(cur.id, patch); updated++; } else skipped++; continue; }
    if (nameSet.has(norm(row.name_ko))) { dupName++; continue; }
    nameSet.add(norm(row.name_ko));
    (row._domestic ? insDom : insFore).push(row);
  }
  const ordered = [...insFore, ...insDom].map(r => { const o = strip(r); o.sort_no = ++maxSort; return o; });
  for (let i = 0; i < ordered.length; i += 100) await sbInsert(ordered.slice(i, i + 100));

  console.log('■ 완료 — 신규추가:', ordered.length, '(국내', insDom.length, '· 해외', insFore.length, ')',
              '· 빈칸보강:', updated, '· 변경없음:', skipped, '· 이름중복스킵:', dupName);
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
