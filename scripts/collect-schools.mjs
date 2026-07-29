// ============================================================
// OPUSCLAM 음악학교(schools) 자동 수집기 (v1·충실도 우선)
//  - 소스: 위키데이터(음악원·음악학교 하위 포함) + 한국어 위키백과 소개
//  - 저명 동문: 역방향 P69(이 학교에서 교육받은 저명인)
//  - 항목: 구분·소재지·설립·저명동문·홈페이지·이미지·위키·소개
//  - 충실도 컷오프 · 충실도 정렬 · 신규추가/빈칸보강/사람값 보호/중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const VERSION = 'v2';   // 로그 첫 줄에 찍힙니다
const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';
const CLASSES = [
  { anchor: 'Q207320',  cat: '음악원' },    // conservatory
  { anchor: 'Q1021290', cat: '음악학교' },  // music school
];

function buildQuery(anchor) {
  return `
SELECT ?item ?nameKo ?nameEn ?country ?countryKo ?countryEn ?cityKo ?cityEn ?inception ?image ?logo ?website ?koArticle ?enArticle WHERE {
  ?item wdt:P31/wdt:P279* wd:${anchor} .
  OPTIONAL { ?item rdfs:label ?nameKo. FILTER(LANG(?nameKo)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn. FILTER(LANG(?nameEn)="en") }
  # 위키데이터의 하위 클래스 연결이 오염되어 군사·정치 조직이 대량으로 딸려 들어옵니다.
  # 이름 단계에서 먼저 걸러 조회량을 줄입니다. (최종 판정은 스크립트에서 한 번 더 합니다)
  FILTER( !BOUND(?nameEn) || !REGEX(?nameEn,
    "brigade|militia|militie|battalion|regiment|legion|guerrilla|paramilitar|freikorps|schutzstaffel|commando|kommando|insurgent|mujahid|fedayeen|jihad|national guard|state guard|state militia|home guard|civil guard|defence force|defense force|liberation (front|army)|armed (forces|group|police)|death squad|\\brifles\\b|artillery|cavalry|infantry", "i") )
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P17 ?country.
    OPTIONAL { ?country rdfs:label ?countryKo. FILTER(LANG(?countryKo)="ko") }
    OPTIONAL { ?country rdfs:label ?countryEn. FILTER(LANG(?countryEn)="en") } }
  OPTIONAL { ?item wdt:P131 ?city.
    OPTIONAL { ?city rdfs:label ?cityKo. FILTER(LANG(?cityKo)="ko") }
    OPTIONAL { ?city rdfs:label ?cityEn. FILTER(LANG(?cityEn)="en") } }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P154 ?logo. }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
  OPTIONAL { ?enArticle schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
}
LIMIT 4000`;
}

/* ── 음악교육 기관인지 최종 판정 ──
   위키데이터 클래스 계층이 오염되어 군사·정치 조직이 섞여 들어옵니다.
   이름으로 한 번 더 걸러냅니다. (SQL 정리에서 실제 항목 40건으로 검증한 규칙) */
const SOLO_EDU = /[ck]on[sz]ervat|conservatoire|conservatori|odeio|odeon|ωδεί|accademia|musikschule|musikhochschule|musikgymnasium|music school|school\s+(of|for)\s+music|singschule|singakadem|muziekschool|zeneiskola|zeneművészeti|kunstschule|kunstakadem|művészetoktatási|음악학교|음악원|음악대학|음악학부|예술고등학교|예술학교|예술중학교|예술대학|예술종합학교|예술종합대학|예술학부|예술학과|군악학교/i;
const MUS_WORD = /music|m[uú]sic|musi[qk]|musica|музык|음악|音楽|tonkunst|philharmon|filarm[oó]n|sangeet|choir|choral|carillon|opera|ballet|muziek|muzy|\bzene|\barts?\b|kunst|művészet|beaux-arts|gesang|canto|\bsing\b|dans|dance|song|lied|hymn|gospel|예술|성악|기악|국악|무용|합창|군악|취주악|관악|현악|피아노|바이올린/i;
const EDU_WORD = /ad[eé]m|school|schule|skola|skolan|skole|h[oö]gskol|institut|escola|escuela|scuola|[eé]cole|liceo|lyc[eé]e|gymnasium|college|universit|faculdade|facultad|faculty|учили|консерватор|школ|학교|대학|학부|학원|trust|settlement|centre|center|centro|iskola|intézmény/i;
const ARMED_WORD = /\bbrigade|brigades|\bfront\b|\blegion\b|battalion|militia|militie|\barmy\b|armed (group|forces|police)|police (force|academy)|special police|liberation (front|army|movement)|resistance (movement|organisation|organization)|jihad|mujahid|fedayeen|guerrilla|paramilitar|weerstandsbeweging|commando|kommando|\bregiment\b|\brifles?\b|insurgent|defen[cs]e force|defen[cs]e corps|national guard|state guard|state navy|home guard|civil guard|protective forces|security (forces|services)|freikorps|schutzstaffel|\bss\b|gestapo|troikas|detachment|artillery|infantry|cavalry|death squad|self-defen[cs]e|volunteer (force|corps|defense)|dosaaf|counterterror|counter-terror|cadet corps|militant|maquis|intelligence (cent|agenc)|special weapons|tactics unit|\bpatriots\b|maritime research|\bguards?\b|\bforces\b|mobilization|executive command|\bcorps\b|\bpolice\b|tactical unit|\btroops?\b|\bsquad\b|방위|수비대|위병|기계화부대|혁명군|근위|기동부대|특수부대|경찰|타격대|기동대|군무|도독부|의병|독립군|광복군|사령부|병단|헌병|참모|군단|군정|군관|무관학교|육군|해군|공군|수군|대테러|여단|무장|민병|해방전선|반군|친위대|자유군단|의용군|국가방위대/i;
const KEEP_NAMES = new Set(['Fontainebleau Schools']);
/* 이름만으로는 판별할 수 없는 군사·정치 조직.
   화면에서 발견하면 이 목록에 이름을 추가하면 다음 수집부터 들어오지 않습니다. */
const DENY_NAMES = new Set([
  'Al-Badar', 'Rusich', 'Mahidi', 'Ahdath', 'Aks 13000',
  '얼스터 방위협회', 'Ulster Defence Association',
  '인민 기계화부대', 'Popular Mobilization Forces',
  '용기의 부대', 'Al-Sanadid Forces',
  'Lebanese Forces – Executive Command',
  '이슬람 혁명 수비대', 'Islamic Revolutionary Guard Corps',
  '세르비아 의용방위군', 'Serb Volunteer Guard',
  '세르비아 방위군', 'Serbian Guard',
  '홍위병', 'Red Guards', "People's Guard (Libya)",
  'United Constitutional Patriots', 'Counterterrorist Intelligence Center',
  'South African Institute for Maritime Research', '베이징 특경대',
  'Mullah Dadullah Front', "Maquis de l'Ain et du Haut-Jura"
]);

function isMusicSchool(row) {
  const blob = [row.name_ko, row.name_en, row.description].filter(Boolean).join(' ');
  if (KEEP_NAMES.has(row.name_ko)) return true;
  if (SOLO_EDU.test(blob)) return true;
  if (MUS_WORD.test(blob) && EDU_WORD.test(blob)) return true;
  return false;
}
function looksArmed(row) {
  if (DENY_NAMES.has(row.name_ko) || (row.name_en && DENY_NAMES.has(row.name_en))) return true;
  const blob = [row.name_ko, row.name_en, row.description].filter(Boolean).join(' ');
  return ARMED_WORD.test(blob);
}

/* ── 위키데이터 P31(무엇의 사례인가) 로 정체를 확인합니다 ──
   이름 추측이 아니라 기록된 분류를 읽는 방식입니다.
   위키데이터의 하위 클래스 연결이 오염되어 군사·경찰 조직이 딸려 들어오는데,
   P31 을 보면 정확히 가려낼 수 있습니다. */
const P31_MIL = /military|paramilitar|armed (forces|group|organisation|organization)|militia|\barmy\b|\bnavy\b|air force|police|gendarmerie|law enforcement|intelligence agency|terrorist|insurgent|guerrilla|rebel|guard (unit|regiment)|regiment|battalion|brigade|division \(military\)|special forces|secret service|군사|경찰|무장|정보기관|준군사/i;
const P31_EDU = /school|university|college|conservator|academy|educational|higher education|institute of (music|art|technology|higher)|gymnasium|lyc[eé]e|institution of higher|학교|대학|교육기관|음악원/i;

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
  // 위키백과 본문(약 1800자) + 대표 이미지(썸네일)를 한 번에
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
  // 한국어 위키 우선, 없으면 영어 위키
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
async function reverseAlumni(qids) {
  // 저명 동문: 역방향 P69(이 학교에서 교육받은 사람) 중 저명한 이(sitelinks>10)
  const out = {}; const CH = 30;
  for (let i = 0; i < qids.length; i += CH) {
    const chunk = qids.slice(i, i + CH).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item (GROUP_CONCAT(DISTINCT ?pL; separator=", ") AS ?alumni) WHERE {'
      + ' VALUES ?item { ' + chunk + ' }'
      + ' ?p wdt:P69 ?item. ?p wikibase:sitelinks ?sl. FILTER(?sl > 10)'
      + ' OPTIONAL { ?p rdfs:label ?pKo. FILTER(LANG(?pKo)="ko") }'
      + ' OPTIONAL { ?p rdfs:label ?pEn. FILTER(LANG(?pEn)="en") }'
      + ' BIND(COALESCE(?pKo,?pEn) AS ?pL) FILTER(BOUND(?pL))'
      + ' } GROUP BY ?item';
    let rows = [];
    try { rows = await sparql(q); } catch (e) { console.log('    (동문 배치 오류, 계속):', e.message); }
    rows.forEach(b => { const id = qidOf(val(b, 'item')); const a = val(b, 'alumni'); if (a) out[id] = a.split(', ').filter(Boolean).slice(0, 4).join(', '); });
    await sleep(1200);
  }
  return out;
}

async function fetchP31(qids) {
  // 항목별 P31 라벨을 모아옵니다 (한국어 우선, 없으면 영어)
  const out = {}; const CH = 150;
  for (let i = 0; i < qids.length; i += CH) {
    const chunk = qids.slice(i, i + CH).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item (GROUP_CONCAT(DISTINCT ?cL; separator=" · ") AS ?cls) WHERE {'
      + ' VALUES ?item { ' + chunk + ' } ?item wdt:P31 ?c .'
      + ' OPTIONAL { ?c rdfs:label ?cKo. FILTER(LANG(?cKo)="ko") }'
      + ' OPTIONAL { ?c rdfs:label ?cEn. FILTER(LANG(?cEn)="en") }'
      + ' BIND(COALESCE(?cKo,?cEn) AS ?cL) FILTER(BOUND(?cL))'
      + ' } GROUP BY ?item';
    let rows = [];
    try { rows = await sparql(q); } catch (e) { console.log('    (P31 배치 오류, 계속):', e.message); }
    rows.forEach(b => { const id = qidOf(val(b, 'item')); const c = val(b, 'cls'); if (c) out[id] = c; });
    await sleep(1000);
  }
  return out;
}

function toRow(b, cat) {
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
    category: cat, location, founded,
    alumni: '',
    // P154(로고)만 씁니다. P18(이미지)에는 건물 사진·깃발이 섞여 있어
    // 로고 자리에 들어가면 안 됩니다.
    logo_url: val(b, 'logo') || '',
    link_home: val(b, 'website') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    link_video: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name_ko),
    description: '',
    _koWiki: val(b, 'koArticle') || '',
    _enWiki: val(b, 'enArticle') || '',
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
  ['founded', 'alumni', 'logo_url', 'link_home'].forEach(k => { if (r[k] && String(r[k]).trim()) c++; });
  return c;
}
const bioOK = (r) => (r.description || '').trim().length >= 150;
function keep(r) {
  // 분류(P31)가 군사·경찰이면 제외 — 교육기관 분류가 함께 있으면 남깁니다
  //   (군악학교는 P31 에 music school 이 함께 기록돼 있습니다)
  if (r._p31 && P31_MIL.test(r._p31) && !P31_EDU.test(r._p31)) return false;
  // 군사·정치 조직만 제외합니다.
  //   "학교임을 증명하지 못하면 제외" 방식은 쓰지 않습니다.
  //   Juilliard School · Sibelius Academy · Peabody Institute · Mozarteum 처럼
  //   고유명만으로 된 명문 음악원이 전부 걸리기 때문입니다.
  //   음악교육 신호가 있으면 군사 낱말이 있어도 남깁니다
  //   (United States Armed Forces School of Music 같은 군악학교).
  if (looksArmed(r) && !isMusicSchool(r)) return false;
  // 그다음 충실도 컷오프
  return bioOK(r) || substanceCount(r) >= 2;
}
function richness(r) {
  let sc = 0;
  if ((r.description || '').trim().length >= 150) sc += 2;
  if (r.alumni && String(r.alumni).trim()) sc += 2;
  if (r.founded && String(r.founded).trim()) sc += 1;
  if (r.logo_url && String(r.logo_url).trim()) sc += 1;
  if (r.link_home && String(r.link_home).trim()) sc += 1;
  if (r.location && String(r.location).trim()) sc += 1;
  if (r.source && r.source !== 'auto') sc += 6;
  return sc;
}

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
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
  const post = (batch) => fetch(SUPABASE_URL + '/rest/v1/schools', {
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
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/schools?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'category', 'location', 'founded', 'alumni', 'logo_url', 'link_home', 'link_wiki', 'link_video', 'description'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

async function rerank() {
  const rows = await sbGetAll('schools', 'id,source,description,alumni,founded,logo_url,link_home,location,sort_no');
  rows.sort((a, b) => richness(a) - richness(b));
  let n = 0, done = 0;
  for (const r of rows) { n++; if (r.sort_no !== n) { await sbUpdate(r.id, { sort_no: n }); done++; } }
  console.log('■ 재정렬(빈약한 항목 뒤로):', rows.length, '행 · sort_no 갱신', done);
}

async function main() {
  console.log('■ 음악학교 수집 시작 [' + VERSION + ']', new Date().toISOString());
  const collected = new Map();
  for (const c of CLASSES) {
    console.log('  · 위키데이터 조회:', c.cat);
    const rows = await sparql(buildQuery(c.anchor));
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b, c.cat));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '곳');

  const allQids = [...collected.keys()];
  console.log('  · 저명 동문 역방향 보강 중…');
  const al = await reverseAlumni(allQids);
  let ac = 0;
  for (const [qid, row] of collected) { if (al[qid]) { row.alumni = al[qid]; ac++; } }
  console.log('    → 저명 동문 보강', ac, '곳');

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

  const all = [...collected.values()];

  /* ── 위키데이터 P31 로 정체 확인 ──
     이름 낱말만으로는 Al-Badar · Rusich 처럼 판별할 수 없는 항목이 있습니다.
     기록된 분류를 읽어 군사·경찰 조직을 정확히 가려냅니다. */
  console.log('■ 분류(P31) 확인');
  const p31 = await fetchP31(all.map(r => r.wikidata_id).filter(Boolean));
  console.log('  분류 확보', Object.keys(p31).length, '/', all.length, '건');
  all.forEach(r => { r._p31 = p31[r.wikidata_id] || ''; });

  const byP31Mil = all.filter(r => r._p31 && P31_MIL.test(r._p31) && !P31_EDU.test(r._p31));
  const armed    = all.filter(r => looksArmed(r) && !isMusicSchool(r));
  const noSignal = all.filter(r => !looksArmed(r) && !isMusicSchool(r));
  const kept     = all.filter(keep);

  console.log('■ 걸러낸 내역');
  console.log('  · 분류가 군사·경찰:', byP31Mil.length, '건  ← P31 기준 (가장 정확)');
  if (byP31Mil.length) byP31Mil.slice(0, 5).forEach(r =>
    console.log('    · ' + r.name_ko + '  [' + r._p31.slice(0, 50) + ']'));
  console.log('  · 이름이 군사·정치 조직:', armed.length, '건  ← 이름 기준 (P31 없는 항목 대비)');
  if (armed.length) console.log('    예:', armed.slice(0, 5).map(r => r.name_ko).join(' / '));
  console.log('  · 음악 낱말 없지만 남긴 항목:', noSignal.length, '건 (Juilliard·Mozarteum 처럼 고유명일 수 있어 남깁니다)');
  if (noSignal.length) console.log('    예:', noSignal.slice(0, 5).map(r => r.name_ko).join(' / '));
  console.log('■ 최종 통과:', kept.length, '곳 (전체', all.length, ')');

  const existing = await sbGetAll('schools', 'id,wikidata_id,name_ko,name_en,category,location,founded,alumni,logo_url,link_home,link_wiki,description,sort_no');
  const blocked = await loadBlocked();
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존 schools:', existing.length, '행');

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
