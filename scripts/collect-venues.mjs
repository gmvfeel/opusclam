// ============================================================
// OPUSCLAM 공연장(venues) 자동 수집기  (v2: 품질 강화)
// - 소스: 위키데이터(SPARQL)
// - 수집 범위: 국내(대한민국)는 전부 · 해외는 한국어 등재 또는 좌석수 있는 곳
// - 원칙: ① 신규 추가  ② 기존은 '빈 칸만' 보강  ③ 사람이 채운 값 보호
// - 중복 방지: wikidata_id + 이름(name_ko) 중복 시 스킵(정식 데이터 보호)
// - 정렬: 국내가 위쪽(높은 sort_no)에 오도록 부여
// - 필요 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884'; // 대한민국(South Korea)

const CLASSES = [
  { qid: 'Q1060829', type: '콘서트홀' },
  { qid: 'Q153562',  type: '오페라하우스' },
];

function buildQuery(clsQid) {
  return `
SELECT ?item ?nameKo ?nameEn ?country ?inception ?capacity ?countryKo ?countryEn ?cityKo ?cityEn ?operatorKo ?operatorEn ?image ?koArticle ?enArticle WHERE {
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
LIMIT 4000`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (uri) => uri ? uri.split('/').pop() : '';
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
  const city    = val(b, 'cityKo')    || val(b, 'cityEn');
  const location = [country, city].filter(Boolean).join(' · ');
  const inc = val(b, 'inception');
  const opened = (inc.match(/(\d{4})/) || [])[1] || '';
  const capNum = parseInt(val(b, 'capacity'), 10);
  const seats = Number.isFinite(capNum) && capNum > 0 ? capNum.toLocaleString('en-US') + '석' : '';
  const operator = val(b, 'operatorKo') || val(b, 'operatorEn') || '';
  const koArticle = val(b, 'koArticle');

  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    type, location, opened, seats, operator,
    logo_url: val(b, 'image') || '',
    link_wiki: koArticle || val(b, 'enArticle') || '',
    source: 'auto',
    _domestic: qidOf(val(b, 'country')) === KR_QID || country === '대한민국' || country === 'South Korea',
    _notable: !!nameKo || !!koArticle || !!seats,   // 한국어 등재 or 좌석수 있음 = 포함
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
async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: H });
  if (!res.ok) throw new Error('GET ' + path + ' → ' + res.status + ' ' + await res.text());
  return res.json();
}
async function sbInsert(rows) {
  if (!rows.length) return;
  const res = await fetch(SUPABASE_URL + '/rest/v1/venues', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error('INSERT → ' + res.status + ' ' + await res.text());
}
async function sbUpdate(id, patch) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/venues?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error('UPDATE ' + id + ' → ' + res.status + ' ' + await res.text());
}

const FILL_COLS = ['name_en', 'type', 'location', 'opened', 'seats', 'operator', 'logo_url', 'link_wiki'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function main() {
  console.log('■ 공연장 수집 시작(v2)', new Date().toISOString());

  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.type, '(' + c.qid + ')');
    const rows = await sparql(buildQuery(c.qid));
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.type));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '곳');

  // 품질 필터: 국내는 전부 · 해외는 유명(한국어 등재)한 곳만
  const kept = [...collected.values()].filter(r => r._domestic || r._notable);
  console.log('■ 필터 통과:', kept.length, '곳 (제외', collected.size - kept.length, ')');

  const existing = await sbGet('venues?select=id,wikidata_id,name_ko,name_en,type,location,opened,seats,operator,logo_url,link_wiki,sort_no');
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) {
    if (r.wikidata_id) byWid.set(r.wikidata_id, r);
    if (r.name_ko) nameSet.add(norm(r.name_ko));
    if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no;
  }
  console.log('■ 기존 venues:', existing.length, '행');

  const insFore = [], insDom = []; let updated = 0, skipped = 0, dupName = 0;
  for (const row of kept) {
    const cur = byWid.get(row.wikidata_id);
    if (cur) { // 기존: 빈 칸만 보강
      const patch = {};
      for (const k of FILL_COLS) if (isEmpty(cur[k]) && !isEmpty(row[k])) patch[k] = row[k];
      if (Object.keys(patch).length) { await sbUpdate(cur.id, patch); updated++; } else skipped++;
      continue;
    }
    if (nameSet.has(norm(row.name_ko))) { dupName++; continue; } // 이름 중복(정식 데이터 등) 스킵
    nameSet.add(norm(row.name_ko));
    (row._domestic ? insDom : insFore).push(row);
  }

  // 정렬: 해외 먼저(낮은 번호) → 국내 나중(높은 번호) => 목록에서 국내가 위로
  const ordered = [...insFore, ...insDom].map(r => { const o = strip(r); o.sort_no = ++maxSort; return o; });
  for (let i = 0; i < ordered.length; i += 100) await sbInsert(ordered.slice(i, i + 100));

  console.log('■ 완료 — 신규추가:', ordered.length, '(국내', insDom.length, '· 해외', insFore.length, ')',
              '· 빈칸보강:', updated, '· 변경없음:', skipped, '· 이름중복스킵:', dupName);
}

main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
