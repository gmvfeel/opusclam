// ============================================================
// OPUSCLAM 현대음악(modern_composers) 자동 수집기 (v2: 대중/영화 장르 제외)
// - 소스: 위키데이터 · 대상: 1900년 이후 출생 작곡가(P106=작곡가)
// - 범위: 1900년 이후 출생 작곡가 · 대중/영화 직업 제외(12종) · 클래식신호 요구 안함(거장 누락 방지)
// - 제외: 대중/영화 직업(가수·송라이터·래퍼·프로듀서·DJ·영화음악가) 보유자 + 대중/영화 장르 전용
// - 원칙: 신규추가 / 빈칸만 보강 / 사람값 보호, 중복방지, 국내 우선 정렬
// - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';

// 클래식 장르 키워드(있으면 유지) / 대중·영화 장르 키워드(이것만 있으면 제외)
const CLASS_KW = ['classical','contemporary classical','20th-century classical','21st-century classical','21st century classical','opera','operetta','chamber','orchestral','symphon','choral','art song','lied','avant-garde','experimental','serial','twelve-tone','minimal','modernism','postminimal','sacred','liturgical','concert music','new music','electroacoustic','musique concr','microtonal','spectral','contemporary music','oratorio','cantata'];
const POPFILM_KW = ['film score','film music','soundtrack','video game','anime','pop music','pop rock','k-pop','synth-pop','dance-pop','electropop',' pop','pop ','rock music','hard rock','punk','metal','indie','hip hop','hip-hop','rap','trap','jazz','blues','rhythm and blues','r&b','soul music','funk','disco','reggae','electronic music','electronic dance','edm','techno','house music','trance','ambient','new-age','new age','country music','folk music','singer-songwriter','musical theatre','musical theater','trot','ballad'];

function baseQuery(constraint, requireClassical) {
  const cls = requireClassical ? '  FILTER( EXISTS { ?item wdt:P135 ?anyMv } || EXISTS { ?item wdt:P136 ?anyG . ?anyG wdt:P279* wd:Q9730 } )\n' : '';
  return `
SELECT ?item
  (SAMPLE(?nameKo_) AS ?nameKo) (SAMPLE(?nameEn_) AS ?nameEn)
  (SAMPLE(?birth_) AS ?birth) (SAMPLE(?death_) AS ?death)
  (SAMPLE(?country_) AS ?country) (SAMPLE(?countryKo_) AS ?countryKo) (SAMPLE(?countryEn_) AS ?countryEn)
  (SAMPLE(?movementKo_) AS ?movementKo) (SAMPLE(?movementEn_) AS ?movementEn)
  (SAMPLE(?image_) AS ?image)
  (SAMPLE(?koArticle_) AS ?koArticle) (SAMPLE(?enArticle_) AS ?enArticle)
  (GROUP_CONCAT(DISTINCT ?genreEn_; separator=" | ") AS ?genres)
WHERE {
  ?item wdt:P106 wd:Q36834 .
  ?item wdt:P569 ?birth_ . FILTER(YEAR(?birth_) >= 1900)
  # 대중/영화 직업 제외: 가수·송라이터·래퍼·프로듀서·DJ·영화음악가 + 밴드(기타/베이스/드럼/키보드)·배우
  FILTER NOT EXISTS { ?item wdt:P106 ?exOcc . VALUES ?exOcc { wd:Q177220 wd:Q753110 wd:Q488205 wd:Q2252262 wd:Q183945 wd:Q130857 wd:Q1415090 wd:Q855091 wd:Q584301 wd:Q386854 wd:Q1622272 wd:Q33999 } }
${cls}  ${constraint}
  OPTIONAL { ?item rdfs:label ?nameKo_. FILTER(LANG(?nameKo_)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn_. FILTER(LANG(?nameEn_)="en") }
  OPTIONAL { ?item wdt:P570 ?death_. }
  OPTIONAL { ?item wdt:P27 ?country_.
    OPTIONAL { ?country_ rdfs:label ?countryKo_. FILTER(LANG(?countryKo_)="ko") }
    OPTIONAL { ?country_ rdfs:label ?countryEn_. FILTER(LANG(?countryEn_)="en") } }
  OPTIONAL { ?item wdt:P135 ?movement_.
    OPTIONAL { ?movement_ rdfs:label ?movementKo_. FILTER(LANG(?movementKo_)="ko") }
    OPTIONAL { ?movement_ rdfs:label ?movementEn_. FILTER(LANG(?movementEn_)="en") } }
  OPTIONAL { ?item wdt:P136 ?genre_. ?genre_ rdfs:label ?genreEn_. FILTER(LANG(?genreEn_)="en") }
  OPTIONAL { ?item wdt:P18 ?image_. }
  OPTIONAL { ?koArticle_ schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
  OPTIONAL { ?enArticle_ schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
}
GROUP BY ?item
LIMIT 5000`;
}
const Q_KR = baseQuery('?item wdt:P27 wd:Q884 .', false);
const Q_KO = baseQuery('?koArticle_ schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>.', false);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? u.split('/').pop() : '';
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();
const yr = (d) => (d.match(/(-?\d{1,4})/) || [])[1] || '';

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

function toRow(b) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null;

  // 장르 판정: 대중/영화만 있고 클래식 없으면 제외
  const genres = (val(b, 'genres') || '').toLowerCase();
  if (genres) {
    const hasClass = CLASS_KW.some(k => genres.includes(k));
    const hasPop = POPFILM_KW.some(k => genres.includes(k));
    if (hasPop && !hasClass) return null;
  }

  const by = yr(val(b, 'birth')), dy = yr(val(b, 'death'));
  const life = by ? (by + '–' + (dy || '')) : '';
  const nationality = val(b, 'countryKo') || val(b, 'countryEn') || '';
  const school_style = val(b, 'movementKo') || val(b, 'movementEn') || '';
  const byNum = parseInt(by, 10);
  const active_period = byNum >= 2000 ? '21세기' : (byNum >= 1900 ? '20세기' : '');
  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    school_style, nationality, life, active_period,
    image_url: val(b, 'image') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    source: 'auto',
    _domestic: qidOf(val(b, 'country')) === KR_QID || nationality === '대한민국' || nationality === 'South Korea',
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
async function sbInsert(rows) { if (!rows.length) return; const r = await fetch(SUPABASE_URL + '/rest/v1/modern_composers', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error('INSERT ' + r.status + ' ' + await r.text()); }
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/modern_composers?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'school_style', 'nationality', 'life', 'active_period', 'image_url', 'link_wiki'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function main() {
  console.log('■ 현대음악 수집 시작(v2)', new Date().toISOString());
  const collected = new Map();
  for (const [label, q] of [['국내 국적', Q_KR], ['한국어 등재', Q_KO]]) {
    console.log('  · 위키데이터 조회:', label);
    const rows = await sparql(q);
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b));
    await sleep(1500);
  }
  console.log('■ 수집(고유, 대중/영화 제외 후):', collected.size, '명');

  const existing = await sbGet('modern_composers?select=id,wikidata_id,name_ko,name_en,school_style,nationality,life,active_period,image_url,link_wiki,sort_no');
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존:', existing.length, '명');

  const insFore = [], insDom = []; let updated = 0, skipped = 0, dupName = 0;
  for (const row of collected.values()) {
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
