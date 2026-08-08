// ============================================================
// OPUSCLAM 인물DB(persons) 자동 보강기 (v1)
// 원칙: 사람이 넣은 값은 건드리지 않는다 · 빈칸만 채운다 · 개수보다 충실도
//  - 대상: 아직 점검하지 않은 인물 우선, 그다음 오래 점검 안 된 인물
//  - 위키데이터: 저명도(sitelinks) · 장르(P136) · 직업(P106) · 생몰(P569/P570)
//               악기(P1303) · 출신학교(P69) · 초상(P18) · 대표작(P800)
//  - 대표작은 역방향(P86: 이 사람이 작곡한 작품)으로도 보강
//  - 소개문: 한국어 위키백과 → 없으면 영문 원문을 description_en 에 별도 보관
//  - 파생값 계산: 분야(field) · 시대(era_name/era_yr) · 충실도(quality)
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, (선택) DAILY_LIMIT
// ============================================================

import { guessField } from './lib/field.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const VERSION     = 'v1.2';   // 로그 첫 줄에 찍힙니다. 이 값이 안 보이면 이전 파일이 돌고 있는 것입니다
const UA          = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '1500', 10);  // 하루 처리량 (무료 분 관리)
const CH_SPARQL   = 150;   // 위키데이터 배치
const CH_WIKI     = 10;    // 위키백과 배치
const CH_REVWORK  = 40;    // 역방향 대표작 배치

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val   = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? u.split('/').pop() : '';
const yr    = (d) => (String(d || '').match(/(-?\d{1,4})/) || [])[1] || '';
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const cap3  = (t) => t ? String(t).split(/,\s*|\s·\s/).map(s => s.trim()).filter(Boolean).slice(0, 3).join(' · ') : '';

/* ---------- Supabase (REST) ---------- */
const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select, filter, maxRows) {
  const out = []; const STEP = 1000; let from = 0;
  const cap = (maxRows === undefined || maxRows === null) ? 100000 : maxRows;
  if (cap <= 0) return out;                 // 0 을 넘기면 전체 조회가 되지 않도록 방어
  while (out.length < cap) {
    const take = Math.min(STEP, cap - out.length);
    const url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (filter || '');
    const r = await fetch(url, { headers: { ...H, Range: from + '-' + (from + take - 1) } });
    if (!r.ok) {
      const body = await r.text();
      console.error('  ✗ 조회 실패 ' + r.status);
      console.error('    URL : ' + url);
      console.error('    응답: ' + body.slice(0, 300));
      throw new Error('GET ' + r.status);
    }
    const batch = await r.json(); out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
  }
  return out;
}

// 시작 전에 필요한 컬럼이 실제로 있는지 확인합니다
async function checkColumns(need) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/persons?select=*&limit=1', { headers: H });
  if (!r.ok) {
    console.error('  ✗ persons 조회 실패 ' + r.status + ' ' + (await r.text()).slice(0, 300));
    throw new Error('persons 접근 불가');
  }
  const rows = await r.json();
  if (!rows.length) { console.log('  · persons 가 비어 있어 컬럼 점검을 건너뜁니다'); return need; }
  const have = Object.keys(rows[0]);
  const missing = need.filter(c => have.indexOf(c) < 0);
  if (missing.length) {
    console.log('  ⚠ 없는 컬럼:', missing.join(', '));
    console.log('    → 해당 항목은 건너뜁니다. SQL 로 컬럼을 먼저 추가하세요.');
  }
  return need.filter(c => have.indexOf(c) >= 0);
}
async function sbUpdate(table, id, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id),
    { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text());
}

/* ---------- 외부 API ---------- */
async function sparql(query, tries = 3) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('SPARQL ' + res.status);
      return (await res.json()).results.bindings;
    } catch (e) { if (i === tries - 1) { console.log('    (SPARQL 배치 오류, 계속):', e.message); return []; } await sleep(3000 * (i + 1)); }
  }
  return [];
}
async function wikiExtracts(host, titles) {
  // 여러 문서의 도입부를 한 번에 가져옵니다
  const p = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', redirects: '1',
    prop: 'extracts', exintro: '1', explaintext: '1', titles: titles.join('|')
  });
  try {
    const r = await fetch('https://' + host + '/w/api.php?' + p.toString(), { headers: { 'User-Agent': UA } });
    if (!r.ok) return {};
    const j = await r.json();
    const pages = (j.query && j.query.pages) || {};
    const out = {};
    Object.keys(pages).forEach(k => {
      const pg = pages[k];
      if (pg.title && pg.extract) out[pg.title] = String(pg.extract).replace(/\s+/g, ' ').trim();
    });
    return out;
  } catch (e) { return {}; }
}

/* ---------- 파생값 계산 ---------- */
// 분야 — 위키데이터 직업 기준. 우선순위: 작곡 > 성악 > 지휘 > 연주 > 음악학 > 음악교육 > 편곡 > 평론
/* ★ 분야 판정 규칙은 scripts/lib/field.mjs 로 옮겼습니다.
   여기와 fix-person-field.mjs 두 곳에 같은 규칙을 두면 반드시 어긋납니다
   (작품 형식표를 하루에 두 번 늘렸던 일과 같습니다).

   2026-08-08 고침 — 예전에는 규칙을 위에서부터 훑어 처음 맞는 것을 썼습니다.
   `composer` 가 맨 앞이라 폴리니(concertmaster, pianist, ... composer)가
   「작곡」이 되었습니다. 이제는 직업 목록에 적힌 순서를 따릅니다. */

// 시대 — 출생년 기준 (음악사 통용 시기)
function guessEra(birthYear) {
  const y = parseInt(birthYear, 10);
  if (!y || y < 800 || y > 2030) return '';
  if (y <  1400) return '중세';
  if (y <= 1580) return '르네상스';
  if (y <= 1700) return '바로크';
  if (y <= 1780) return '고전주의';
  if (y <= 1870) return '낭만주의';
  if (y <= 1930) return '근·현대';
  return '현대';
}
// 충실도 — 리스트 기본 정렬에 사용. 배점은 db-11 SQL 과 동일하게 유지
function calcQuality(r) {
  const ok = (v) => !isEmpty(v);
  const koDesc = ok(r.description) && !/^[|{]/.test(String(r.description).trim());
  return (koDesc ? 30 : 0)
    + (ok(r.image_url)      ? 15 : 0)
    + (ok(r.life)           ? 12 : 0)
    + (ok(r.description_en) ? 10 : 0)
    + (ok(r.school)         ?  8 : 0)
    + (ok(r.works)          ?  7 : 0)
    + (ok(r.instrument)     ?  5 : 0)
    + (ok(r.era_name)       ?  5 : 0)
    + Math.floor(Math.min(parseInt(r.wd_links, 10) || 0, 20) / 2);
}

/* ---------- 위키데이터 일괄 조회 ---------- */
function metaQuery(qids) {
  const vs = qids.map(q => 'wd:' + q).join(' ');
  return `
SELECT ?item ?n ?birth ?death ?image ?koA ?enA
  (GROUP_CONCAT(DISTINCT ?genL; separator=", ")  AS ?genres)
  (GROUP_CONCAT(DISTINCT ?occL; separator=", ")  AS ?occs)
  (GROUP_CONCAT(DISTINCT ?insL; separator=" · ") AS ?instruments)
  (GROUP_CONCAT(DISTINCT ?schL; separator=" · ") AS ?schools)
  (GROUP_CONCAT(DISTINCT ?wkL;  separator=" · ") AS ?works)
WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item wikibase:sitelinks ?n }
  OPTIONAL { ?item wdt:P569 ?birth }
  OPTIONAL { ?item wdt:P570 ?death }
  OPTIONAL { ?item wdt:P18  ?image }
  OPTIONAL { ?item wdt:P136 ?g . ?g rdfs:label ?genL FILTER(LANG(?genL)="en") }
  OPTIONAL { ?item wdt:P106 ?o . ?o rdfs:label ?occL FILTER(LANG(?occL)="en") }
  OPTIONAL { ?item wdt:P1303 ?i .
    OPTIONAL { ?i rdfs:label ?insKo FILTER(LANG(?insKo)="ko") }
    OPTIONAL { ?i rdfs:label ?insEn FILTER(LANG(?insEn)="en") }
    BIND(COALESCE(?insKo, ?insEn) AS ?insL) }
  OPTIONAL { ?item wdt:P69 ?s .
    OPTIONAL { ?s rdfs:label ?schKo FILTER(LANG(?schKo)="ko") }
    OPTIONAL { ?s rdfs:label ?schEn FILTER(LANG(?schEn)="en") }
    BIND(COALESCE(?schKo, ?schEn) AS ?schL) }
  OPTIONAL { ?item wdt:P800 ?w .
    OPTIONAL { ?w rdfs:label ?wkKo FILTER(LANG(?wkKo)="ko") }
    OPTIONAL { ?w rdfs:label ?wkEn FILTER(LANG(?wkEn)="en") }
    BIND(COALESCE(?wkKo, ?wkEn) AS ?wkL) }
  OPTIONAL { ?koA schema:about ?item ; schema:isPartOf <https://ko.wikipedia.org/> }
  OPTIONAL { ?enA schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
}
GROUP BY ?item ?n ?birth ?death ?image ?koA ?enA`;
}

// 역방향 대표작 — 이 인물이 작곡한(P86) 작품 중 저명한 것
async function reverseWorks(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += CH_REVWORK) {
    const chunk = qids.slice(i, i + CH_REVWORK).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item (GROUP_CONCAT(DISTINCT ?wL; separator=" · ") AS ?works) WHERE {'
      + ' VALUES ?item { ' + chunk + ' }'
      + ' ?work wdt:P86 ?item. ?work wikibase:sitelinks ?sl. FILTER(?sl > 8)'
      + ' OPTIONAL { ?work rdfs:label ?wKo. FILTER(LANG(?wKo)="ko") }'
      + ' OPTIONAL { ?work rdfs:label ?wEn. FILTER(LANG(?wEn)="en") }'
      + ' BIND(COALESCE(?wKo,?wEn) AS ?wL) FILTER(BOUND(?wL))'
      + ' } GROUP BY ?item';
    const rows = await sparql(q);
    rows.forEach(b => { const id = qidOf(val(b, 'item')); const w = val(b, 'works'); if (w) out[id] = cap3(w); });
    await sleep(1200);
  }
  return out;
}

/* ---------- 본체 ---------- */
async function main() {
  console.log('■ 인물DB 보강 시작 [' + VERSION + ']', new Date().toISOString(), '| 하루 한도', DAILY_LIMIT);
  console.log('  · Node', process.version, '· 대상 URL', (SUPABASE_URL || '').replace(/https:\/\//, '').slice(0, 30));

  // 0) 컬럼 점검 — 없는 컬럼을 요청하면 400 이 나므로 미리 확인합니다
  const WANT = ['id','wikidata_id','name_ko','name_en','field','life','era_name','era_yr',
                'instrument','school','works','image_url','description','description_en',
                'link_wiki','wd_links','wd_genre','wd_occupation','wd_checked_at','quality','hidden'];
  const COLS_ARR = await checkColumns(WANT);
  const COLS = COLS_ARR.join(',');
  const has = (c) => COLS_ARR.indexOf(c) >= 0;
  const HID = has('hidden') ? '&hidden=is.false' : '';

  // 1) 시대별 era_yr 표기를 DB에서 그대로 배워옵니다 (제가 새 표기를 만들지 않습니다)
  const eraYr = {};
  if (has('era_name') && has('era_yr')) {
    const eraRows = await sbGetAll('persons', 'era_name,era_yr',
      '&era_name=not.is.null&era_yr=not.is.null', 3000);
    eraRows.forEach(r => { if (r.era_name && r.era_yr && !eraYr[r.era_name]) eraYr[r.era_name] = r.era_yr; });
  }
  console.log('  · 시대 표기 학습:', Object.keys(eraYr).join(', ') || '(없음)');

  // 2) 처리 대상 — 미점검 우선, 그다음 오래된 순
  let targets = [];
  if (has('wd_checked_at')) {
    targets = await sbGetAll('persons', COLS,
      HID + '&wikidata_id=not.is.null&wd_checked_at=is.null', DAILY_LIMIT);
    if (targets.length < DAILY_LIMIT) {
      const more = await sbGetAll('persons', COLS,
        HID + '&wikidata_id=not.is.null&wd_checked_at=not.is.null&order=wd_checked_at.asc',
        DAILY_LIMIT - targets.length);
      const seen = new Set(targets.map(t => t.id));
      more.forEach(m => { if (!seen.has(m.id)) targets.push(m); });
    }
  } else {
    // wd_checked_at 컬럼이 없으면 저명도 미조회 인물부터
    targets = await sbGetAll('persons', COLS, HID + '&wikidata_id=not.is.null', DAILY_LIMIT);
  }
  console.log('■ 처리 대상:', targets.length, '명');
  if (!targets.length) { console.log('■ 대상이 없습니다. 종료'); return; }

  const byQid = new Map();
  targets.forEach(t => { if (t.wikidata_id) byQid.set(t.wikidata_id, t); });
  const qids = [...byQid.keys()];

  // 3) 위키데이터 메타 조회
  console.log('■ 위키데이터 조회 (' + qids.length + '건)');
  const meta = {};
  for (let i = 0; i < qids.length; i += CH_SPARQL) {
    const rows = await sparql(metaQuery(qids.slice(i, i + CH_SPARQL)));
    rows.forEach(b => {
      const id = qidOf(val(b, 'item'));
      meta[id] = {
        links: parseInt(val(b, 'n'), 10) || 0,
        birth: yr(val(b, 'birth')), death: yr(val(b, 'death')),
        image: val(b, 'image'),
        genres: val(b, 'genres'), occs: val(b, 'occs'),
        instrument: val(b, 'instruments'), school: val(b, 'schools'),
        works: val(b, 'works'),
        koA: val(b, 'koA'), enA: val(b, 'enA'),
      };
    });
    console.log('  · ' + Math.min(i + CH_SPARQL, qids.length) + '/' + qids.length);
    await sleep(1200);
  }

  // 4) 대표작이 비어 있는 인물만 역방향 보강
  const needWorks = qids.filter(q => {
    const cur = byQid.get(q), m = meta[q];
    return isEmpty(cur.works) && (!m || isEmpty(m.works));
  });
  console.log('■ 대표작 역방향 보강 (' + needWorks.length + '명)');
  const rev = needWorks.length ? await reverseWorks(needWorks) : {};

  // 5) 소개문 — 한국어 위키백과 (description 이 비어 있는 인물만)
  const koJobs = [];  // [title, target]
  const enJobs = [];
  for (const q of qids) {
    const cur = byQid.get(q), m = meta[q] || {};
    const koBad = isEmpty(cur.description) || /^[|{]/.test(String(cur.description).trim());
    if (koBad && m.koA) koJobs.push([decodeURIComponent(m.koA.split('/wiki/')[1] || '').replace(/_/g, ' '), cur]);
    else if (koBad && !m.koA && m.enA && isEmpty(cur.description_en)) {
      enJobs.push([decodeURIComponent(m.enA.split('/wiki/')[1] || '').replace(/_/g, ' '), cur]);
    }
  }
  const grabbed = { ko: 0, en: 0 };
  async function fillFrom(host, jobs, key) {
    for (let i = 0; i < jobs.length; i += CH_WIKI) {
      const slice = jobs.slice(i, i + CH_WIKI);
      const got = await wikiExtracts(host, slice.map(j => j[0]).filter(Boolean));
      slice.forEach(([title, t]) => {
        const txt = got[title];
        if (txt && txt.length >= 20) { t['_' + key] = txt.slice(0, key === 'ko' ? 400 : 700); grabbed[key]++; }
      });
      await sleep(200);
    }
  }
  console.log('■ 한국어 소개문 (' + koJobs.length + '명) · 영문 원문 (' + enJobs.length + '명)');
  if (koJobs.length) await fillFrom('ko.wikipedia.org', koJobs, 'ko');
  if (enJobs.length) await fillFrom('en.wikipedia.org', enJobs, 'en');
  console.log('  · 확보 — 한국어', grabbed.ko, '· 영문', grabbed.en);

  // 6) 저장 — 빈칸만 채우고, 사람이 넣은 값은 건드리지 않습니다
  let nFill = 0, nMeta = 0, nQual = 0, nSkip = 0;
  const now = new Date().toISOString();
  for (const q of qids) {
    const cur = byQid.get(q), m = meta[q] || {};
    const patch = {};

    // 위키데이터 메타는 항상 최신으로 갱신 (판정 근거이므로)
    if (m.links !== undefined) { patch.wd_links = m.links; nMeta++; }
    if (m.genres) patch.wd_genre = m.genres.slice(0, 400);
    if (m.occs)   patch.wd_occupation = m.occs.slice(0, 400);
    if (has('wd_checked_at')) patch.wd_checked_at = now;

    // 빈칸 보강
    if (isEmpty(cur.life) && m.birth)                patch.life = m.birth + '–' + (m.death || '');
    if (isEmpty(cur.instrument) && m.instrument)     patch.instrument = m.instrument.split(' · ')[0];
    if (isEmpty(cur.school) && m.school)             patch.school = cap3(m.school);
    if (isEmpty(cur.image_url) && m.image)           patch.image_url = m.image;
    if (isEmpty(cur.works)) {
      if (m.works)      patch.works = cap3(m.works);
      else if (rev[q])  patch.works = rev[q];
    }
    if (isEmpty(cur.link_wiki) && (m.koA || m.enA))  patch.link_wiki = m.koA || m.enA;
    if (cur._ko) patch.description    = cur._ko;
    if (cur._en && has('description_en')) patch.description_en = cur._en;

    // 파생값
    const occNow = patch.wd_occupation || cur.wd_occupation || '';
    if (isEmpty(cur.field)) { const f = guessField(occNow); if (f) patch.field = f; }
    if (isEmpty(cur.era_name)) {
      const era = guessEra(m.birth || yr(cur.life));
      if (era) { patch.era_name = era; if (eraYr[era]) patch.era_yr = eraYr[era]; }
    }

    // 충실도 — 갱신 후 값 기준으로 계산
    const after = { ...cur, ...patch };
    const qual = calcQuality(after);
    if (has('quality') && qual !== cur.quality) { patch.quality = qual; nQual++; }

    if (Object.keys(patch).length <= 2) { nSkip++; }   // wd_checked_at 만 바뀌는 경우
    try { await sbUpdate('persons', cur.id, patch); nFill++; }
    catch (e) { console.log('    (저장 오류 id=' + cur.id + '):', e.message); }
  }

  console.log('■ 저장 완료 —', nFill, '명 갱신 · 충실도 변경', nQual, '· 실질 변화 없음', nSkip);
  console.log('■ 완료', new Date().toISOString());
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
