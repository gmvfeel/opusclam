// ============================================================
// OPUSCLAM 현대음악(modern_composers) 자동 수집기 (v4)
// 원칙: 개수보다 '충실도' 최우선.
//  - 대상: 1900년 이후 출생 작곡가(P106=작곡가) · 국내 + 한국어 등재
//  - 대중/영화 직업 제외(12종) · 명백히 클래식 무관(대중장르 전용) 배제
//  - 대표작: 역방향 P86(저명 작품) · 소개: 한국어 위키백과 본문
//  - 충실도 컷오프(B): 실질 정보 없는 '이름만' 항목은 DB에서 제외
//  - 충실도 순 정렬 · 신규추가/빈칸보강/사람값 보호/중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const KR_QID = 'Q884';

const CLASS_KW = ['classical','contemporary classical','20th-century classical','21st-century classical','opera','operetta','chamber','orchestral','symphon','choral','art song','avant-garde','experimental','serial','twelve-tone','minimal','modernism','sacred','concert music','new music','electroacoustic','microtonal','spectral','contemporary music','oratorio','cantata',
  '현대음악','클래식','관현악','교향','실내악','오페라','합창','가곡','전위','작곡가','성악','피아노 협주','국악관현'];
const POPFILM_KW = ['film score','film music','soundtrack','video game','anime','pop music','k-pop','synth-pop','rock music','punk','metal','hip hop','hip-hop','rap','trap','jazz','blues','r&b','soul music','funk','disco','reggae','electronic music','edm','techno','house music','trance','country music','folk music','singer-songwriter','musical theatre','trot','ballad',
  '대중가요','민중가요','트로트','가요','영화음악','드라마','오에스티','ost','아이돌','밴드','록','재즈','힙합','발라드','뮤지컬'];

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

function baseQuery(constraint) {
  return `
SELECT ?item
  (SAMPLE(?nameKo_) AS ?nameKo) (SAMPLE(?nameEn_) AS ?nameEn)
  (SAMPLE(?birth_) AS ?birth) (SAMPLE(?death_) AS ?death)
  (SAMPLE(?country_) AS ?country) (SAMPLE(?countryKo_) AS ?countryKo) (SAMPLE(?countryEn_) AS ?countryEn) (SAMPLE(?natCode_) AS ?natCode)
  (SAMPLE(?movementKo_) AS ?movementKo) (SAMPLE(?movementEn_) AS ?movementEn)
  (SAMPLE(?image_) AS ?image)
  (SAMPLE(?koArticle_) AS ?koArticle) (SAMPLE(?enArticle_) AS ?enArticle)
  (GROUP_CONCAT(DISTINCT ?workKo_; separator=", ") AS ?worksKo)
  (GROUP_CONCAT(DISTINCT ?workEn_; separator=", ") AS ?worksEn)
  (GROUP_CONCAT(DISTINCT ?teacherKo_; separator=", ") AS ?teachersKo)
  (GROUP_CONCAT(DISTINCT ?teacherEn_; separator=", ") AS ?teachersEn)
  (GROUP_CONCAT(DISTINCT ?genreEn_; separator=" | ") AS ?genres)
WHERE {
  ?item wdt:P106 wd:Q36834 .
  ?item wdt:P569 ?birth_ . FILTER(YEAR(?birth_) >= 1900)
  FILTER NOT EXISTS { ?item wdt:P106 ?exOcc . VALUES ?exOcc { wd:Q177220 wd:Q753110 wd:Q488205 wd:Q2252262 wd:Q183945 wd:Q130857 wd:Q1415090 wd:Q855091 wd:Q584301 wd:Q386854 wd:Q1622272 wd:Q33999 } }
  ${constraint}
  OPTIONAL { ?item rdfs:label ?nameKo_. FILTER(LANG(?nameKo_)="ko") }
  OPTIONAL { ?item rdfs:label ?nameEn_. FILTER(LANG(?nameEn_)="en") }
  OPTIONAL { ?item wdt:P570 ?death_. }
  OPTIONAL { ?item wdt:P27 ?country_.
    OPTIONAL { ?country_ rdfs:label ?countryKo_. FILTER(LANG(?countryKo_)="ko") }
    OPTIONAL { ?country_ rdfs:label ?countryEn_. FILTER(LANG(?countryEn_)="en") }
    OPTIONAL { ?country_ wdt:P297 ?natCode_. } }
  OPTIONAL { ?item wdt:P135 ?movement_.
    OPTIONAL { ?movement_ rdfs:label ?movementKo_. FILTER(LANG(?movementKo_)="ko") }
    OPTIONAL { ?movement_ rdfs:label ?movementEn_. FILTER(LANG(?movementEn_)="en") } }
  OPTIONAL { ?item wdt:P800 ?work_.
    OPTIONAL { ?work_ rdfs:label ?workKo_. FILTER(LANG(?workKo_)="ko") }
    OPTIONAL { ?work_ rdfs:label ?workEn_. FILTER(LANG(?workEn_)="en") } }
  OPTIONAL { ?item wdt:P1066 ?teacher_.
    OPTIONAL { ?teacher_ rdfs:label ?teacherKo_. FILTER(LANG(?teacherKo_)="ko") }
    OPTIONAL { ?teacher_ rdfs:label ?teacherEn_. FILTER(LANG(?teacherEn_)="en") } }
  OPTIONAL { ?item wdt:P136 ?genre_. ?genre_ rdfs:label ?genreEn_. FILTER(LANG(?genreEn_)="en") }
  OPTIONAL { ?item wdt:P18 ?image_. }
  OPTIONAL { ?koArticle_ schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
  OPTIONAL { ?enArticle_ schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
}
GROUP BY ?item
LIMIT 5000`;
}
const Q_KR = baseQuery('?item wdt:P27 wd:Q884 .');
const Q_KO = baseQuery('?koArticle_ schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>.');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? u.split('/').pop() : '';
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').trim();
const yr = (d) => (d.match(/(-?\d{1,4})/) || [])[1] || '';
const cap3 = (t) => t ? t.split(', ').filter(Boolean).slice(0, 3).join(', ') : '';

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

function toRow(b) {
  const nameKo = val(b, 'nameKo'), nameEn = val(b, 'nameEn');
  const name_ko = nameKo || nameEn;
  if (!name_ko) return null;
  const by = yr(val(b, 'birth')), dy = yr(val(b, 'death'));
  const life = by ? (by + '–' + (dy || '')) : '';
  const nationality = val(b, 'countryKo') || val(b, 'countryEn') || '';
  const school_style = val(b, 'movementKo') || val(b, 'movementEn') || '';
  const byNum = parseInt(by, 10);
  const active_period = byNum >= 2000 ? '21세기' : (byNum >= 1900 ? '20세기' : '');
  return {
    wikidata_id: qidOf(val(b, 'item')),
    name_ko, name_en: nameEn || '',
    school_style, nationality, nat_code: (val(b, 'natCode') || '').toUpperCase(),
    life, works: cap3(val(b, 'worksKo') || val(b, 'worksEn')), lineage: cap3(val(b, 'teachersKo') || val(b, 'teachersEn')),
    active_period, image_url: val(b, 'image') || '',
    link_wiki: val(b, 'koArticle') || val(b, 'enArticle') || '',
    description: '',
    source: 'auto',
    _genres: (val(b, 'genres') || '').toLowerCase(),
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

async function reverseWorks(qids) {
  const out = {}; const CH = 40;
  for (let i = 0; i < qids.length; i += CH) {
    const chunk = qids.slice(i, i + CH).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item (GROUP_CONCAT(DISTINCT ?wL; separator=", ") AS ?works) WHERE {'
      + ' VALUES ?item { ' + chunk + ' }'
      + ' ?work wdt:P86 ?item. ?work wikibase:sitelinks ?sl. FILTER(?sl > 8)'
      + ' OPTIONAL { ?work rdfs:label ?wKo. FILTER(LANG(?wKo)="ko") }'
      + ' OPTIONAL { ?work rdfs:label ?wEn. FILTER(LANG(?wEn)="en") }'
      + ' BIND(COALESCE(?wKo,?wEn) AS ?wL) FILTER(BOUND(?wL))'
      + ' } GROUP BY ?item';
    let rows = [];
    try { rows = await sparql(q); } catch (e) { console.log('    (대표작 배치 오류, 계속):', e.message); }
    rows.forEach(b => { const id = qidOf(val(b, 'item')); const w = val(b, 'works'); if (w) out[id] = w.split(', ').filter(Boolean).slice(0, 3).join(', '); });
    await sleep(1200);
  }
  return out;
}

// 충실도/분류
function classify(r) {
  const text = (r._genres + ' ' + (r.description || '') + ' ' + (r.school_style || '')).toLowerCase();
  const hasClassical = CLASS_KW.some(k => text.includes(k));
  const hasPop = POPFILM_KW.some(k => text.includes(k));
  return { hasClassical, hasPop };
}
function substanceCount(r) {
  let c = 0;
  if (r.works && r.works.trim()) c++;
  if (r.lineage && r.lineage.trim()) c++;
  if (r.school_style && r.school_style.trim()) c++;
  if (r.image_url && r.image_url.trim()) c++;
  return c;
}
function bioOK(r) { return (r.description || '').trim().length >= 150; }

// ── 이 표에 넣지 않을 사람 ─────────────────────────────────
//  연주자 · 지휘자 · 대중음악 · 영화음악 등, 현대음악 작곡가가 아닌 분들입니다.
//
//  차단 목록(blocklist)에 넣지 않는 까닭
//    그 목록은 위키데이터 번호 하나로 모든 수집기에 함께 적용됩니다.
//    손열음 · 정명훈 · 조성진은 인물DB 에 반드시 있어야 하는 분들이므로,
//    전역으로 차단하면 인물 수집(목 · 금 · 토)에서도 막히고
//    지워졌을 때 되살릴 수 없습니다.
//    그래서 이 표 전용 목록을 여기 둡니다.
//
//  이름을 더 막아야 하면 아래에 한 줄씩 보태면 됩니다.
//  한글 · 영문 어느 쪽으로 들어와도 걸리게 두 벌을 함께 적습니다.
const EXCLUDE = new Set([
  /* 연주자 · 지휘자 (2026-07-29) */
  '손열음', 'yeoleumson',
  '정명훈', 'myungwhunchung',
  '원일', 'ilwon',
  '조성진', 'seongjincho',
  '심은지', 'simeunjee',
  /* 영화 · 영상 */
  '홍상수', '이동준', '모그',
  /* 대중음악 · 게임 · 방송 */
  '길옥윤', '김형석', '이현승', '최승현', '김호철',
  'esti', '이루마', '송병준', '킵루츠',
  /* 그 밖에 확인된 클래식 무관 */
  '김장우', '문성남', '심현정', '한원탁', '박영근', '임용훈',
  /* 종교단체 창시자 · 작곡 활동을 내세우나 음악가가 아닙니다 (2026-07-29) */
  '오카와류호', '오오카와류호', 'ryuhookawa', 'okawaryuho', '大川隆法',
]);

// 이름을 견주기 좋게 다듬습니다.
//   '조성진 (피아니스트)' 처럼 붙는 괄호와 공백 · 기호 · 대소문자를 지웁니다.
function nameKey(v) {
  return String(v || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    // 한자도 남깁니다. 일본 · 중국 인물이 한자 이름으로 들어올 수 있습니다.
    .replace(/[^0-9a-z가-힣\u3400-\u9fff]/g, '');
}

function excluded(r) {
  return EXCLUDE.has(nameKey(r.name_ko)) || EXCLUDE.has(nameKey(r.name_en));
}

// 컷오프 B(중간): 실질 정보가 있어야 포함
function keep(r) {
  if (excluded(r)) return false;                      // 이 표에 넣지 않기로 한 사람
  const { hasClassical, hasPop } = classify(r);
  if (hasPop && !hasClassical) return false;        // 명백히 클래식 무관 배제
  if (bioOK(r)) return true;                          // 실제 소개(전기) 있으면 충실
  const sc = substanceCount(r);
  if (sc >= 2) return true;                           // 실질 항목 2개 이상
  if (hasClassical && sc >= 1) return true;           // 클래식 신호 + 실질 1개
  return false;                                       // 그 외(이름만) 제외
}
function richness(r) {
  let sc = 0;
  if (r.works && String(r.works).trim()) sc += 3;
  if (r.lineage && String(r.lineage).trim()) sc += 2;
  if (r.school_style && String(r.school_style).trim()) sc += 2;
  if ((r.description || '').trim().length >= 150) sc += 2;
  if (r.image_url && String(r.image_url).trim()) sc += 1;
  if (r.nat_code && String(r.nat_code).trim()) sc += 1;
  if (r.life && String(r.life).trim()) sc += 1;
  if (r.nationality && String(r.nationality).trim()) sc += 1;
  if (r.source && r.source !== 'auto') sc += 6;
  return sc;
}

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(p) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + p, { headers: H }); if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text()); return r.json(); }
async function sbInsert(rows) {
  if (!rows.length) return;
  const post = (batch) => fetch(SUPABASE_URL + '/rest/v1/modern_composers', {
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
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/modern_composers?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const FILL_COLS = ['name_en', 'school_style', 'nationality', 'nat_code', 'life', 'works', 'lineage', 'active_period', 'image_url', 'link_wiki', 'description'];
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const strip = (r) => { const o = { ...r }; Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };

/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + orderFor(table),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
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
async function rerank() {
  const rows = await sbGetAll('modern_composers', 'id,source,works,lineage,school_style,description,image_url,nat_code,life,nationality,sort_no');
  rows.sort((a, b) => richness(a) - richness(b));
  let n = 0, done = 0;
  for (const r of rows) { n++; if (r.sort_no !== n) { await sbUpdate(r.id, { sort_no: n }); done++; } }
  console.log('■ 재정렬(빈약한 항목 뒤로):', rows.length, '행 · sort_no 갱신', done);
}

async function main() {
  console.log('■ 현대음악 수집 시작(v4·충실도 우선)', new Date().toISOString());
  const collected = new Map();
  for (const [label, q] of [['국내 국적', Q_KR], ['한국어 등재', Q_KO]]) {
    console.log('  · 위키데이터 조회:', label);
    const rows = await sparql(q);
    console.log('    → 원시 결과', rows.length, '행');
    for (const b of rows) mergeById(collected, toRow(b));
    await sleep(1500);
  }
  console.log('■ 수집(고유):', collected.size, '명');

  const allQids = [...collected.keys()];
  console.log('  · 대표작 역방향 보강 중…');
  const rw = await reverseWorks(allQids);
  for (const [qid, row] of collected) { if (rw[qid]) row.works = rw[qid]; }

  // 한국어 위키백과 본문(소개) 보강
  const withKo = [...collected.values()].filter(r => (r.link_wiki || '').indexOf('ko.wikipedia.org') >= 0);
  console.log('  · 한국어 위키백과 소개 보강 중…', withKo.length, '명');
  let bc = 0;
  for (const r of withKo) { const ex = await wikiExtract(r.link_wiki); if (ex) { r.description = ex.slice(0, 500); bc++; } await sleep(120); }
  console.log('    → 소개 보강', bc, '명');

  // 충실도 컷오프 + 클래식 무관 배제
  const kept = [...collected.values()].filter(keep);
  console.log('■ 충실도 통과:', kept.length, '명 (제외', collected.size - kept.length, ')');

  // 1000행 제한을 넘겨 전부 읽습니다
  const existing = await sbGetAll('modern_composers', 'id,wikidata_id,name_ko,name_en,school_style,nationality,nat_code,life,works,lineage,active_period,image_url,link_wiki,description,sort_no');
  const blocked = await loadBlocked();
  const byWid = new Map(); const nameSet = new Set(); let maxSort = 0;
  for (const r of existing) { if (r.wikidata_id) byWid.set(r.wikidata_id, r); if (r.name_ko) nameSet.add(norm(r.name_ko)); if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no; }
  console.log('■ 기존:', existing.length, '명');

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
