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

import { decideField } from './lib/field.mjs';

import { readJson } from './lib/json.mjs';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const VERSION     = 'v1.3';   // 로그 첫 줄에 찍힙니다. 이 값이 안 보이면 이전 파일이 돌고 있는 것입니다
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
    const batch = await readJson(r); out.push(...batch);
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
  const rows = await readJson(r);
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
      return (await readJson(res)).results.bindings;
    } catch (e) { if (i === tries - 1) { console.log('    (SPARQL 배치 오류, 계속):', e.message); return []; } await sleep(3000 * (i + 1)); }
  }
  return [];
}
/* ★★ 2026-08-12 v1.3 · 소개문을 <b>제대로</b> 받아옵니다 ★★
   ────────────────────────────────────────────────────────────────
   ★ 무엇이 문제였나 (파트너 지적 — 존 애덤스는 위키에 자료가 많은데 비어 있음)
     세 가지가 겹쳐 있었습니다.

       ① exintro:'1'        문서 <b>도입부만</b> 받았습니다.
       ② \s+ → ' '          <b>줄바꿈을 지웠습니다.</b> 그래서 화면에서 한
                             덩어리로 나왔습니다(실제로 줄바꿈이 남은 것은
                             15,233명 중 60명뿐이었습니다).
       ③ slice(0, 400)      받은 것을 <b>400자에서 잘랐습니다</b>(영문 700자).
                             이게 가장 직접적인 원인입니다 — 실측 결과
                             한국어 소개 평균 249자 · 가장 긴 것도 1,758자,
                             1,000자 넘는 사람이 <b>한 명</b>뿐이었습니다.

   ★ 어떻게 고쳤나
     · exintro 를 뺍니다 → 문서 본문이 옵니다.
     · <b>다만 통째로 쓰지 않습니다.</b> 위키 문서는 수만 자가 되고 뒤쪽에는
       「같이 보기 · 각주 · 외부 링크」 같은 목록이 붙습니다. 그래서
       <b>앞쪽 절 몇 개만</b> 쓰고 그 뒤는 버립니다(sectionsOf).
     · 줄바꿈은 <b>살립니다.</b> 줄 안의 여러 공백만 정리합니다.
     · 자르는 길이를 넉넉히 둡니다(아래 MAX_KO · MAX_EN).

   ★ explaintext 는 그대로 둡니다 — 표·틀 없이 글만 받는 값입니다. */
const MAX_KO = 4000;   // 한국어 소개 최대 (예전 400)
const MAX_EN = 4000;   // 영문 소개 최대 (예전 700)
const MAX_SECTIONS = 4; // 앞에서부터 쓸 절 수 (머리말 + 생애 등)

/* 위키 글에서 <b>앞쪽 절 몇 개만</b> 남깁니다.
   explaintext 로 받으면 절 제목이 「== 생애 ==」 꼴로 들어옵니다.
   ★ 뒤쪽의 목록성 절은 이름으로 걸러 냅니다 — 본문이 아니라
     참고 자료 목록이라 소개문에 넣으면 읽을 수 없게 됩니다. */
function trimWiki(raw) {
  /* ★ 여기서 멈출 절 이름
       ★ 「작품」·「수상」을 막는 까닭 — 그 내용은 <b>이미 따로 담겨 있습니다.</b>
         대표작 person_works 16,642건 · 수상 person_awards 5,989건.
         소개문에 목록이 또 들어가면 화면에서 두 번 보입니다.
       ★ 한국어와 영문을 <b>짝을 맞춰</b> 적습니다. 검증에서 「작품」 단독이
         빠져 있어(영문은 Works 를 막는데) 「작품」 절이 새어 들어왔습니다. */
  const BAD = new RegExp('^(' + [
    /* 참고·목록성 */
    '같이\\s*보기', '각주', '주석', '참고\\s*문헌', '외부\\s*링크', '더\\s*읽을거리',
    '관련\\s*항목', '출처', '목록', '둘러보기',
    /* 이미 따로 담긴 것 */
    '작품', '작품\\s*목록', '주요\\s*작품', '대표작', '음반', '음반\\s*목록', '디스코그래피',
    '수상', '수상\\s*내역', '서훈', '상훈',
    /* 본문이 아니라 평가·영향 정리 */
    '영향', '평가', '평가와\\s*유산', '유산',
    /* 영문 */
    'See also', 'References', 'Notes', 'Further reading', 'External links',
    'Bibliography', 'Discography', 'Works', 'Selected works', 'Compositions',
    'Awards', 'Awards and honours', 'Honours', 'Sources', 'Footnotes', 'Citations',
    'Legacy', 'Recordings'
  ].join('|') + ')$', 'i');
  const txt = String(raw || '').replace(/\r/g, '');
  /* 절 제목 줄(== … ==)을 기준으로 나눕니다. 첫 조각은 머리말입니다. */
  const parts = txt.split(/\n(?==+[^=\n]+=+\s*$)/m);
  const out = [];
  for (let i = 0; i < parts.length && out.length < MAX_SECTIONS; i++) {
    const seg = parts[i];
    const m = /^=+\s*([^=\n]+?)\s*=+\s*$/m.exec(seg.split('\n')[0] || '');
    const name = m ? m[1].trim() : '';
    if (name && BAD.test(name)) break;          /* 목록성 절이 나오면 거기서 멈춥니다 */
    /* 절 제목 줄은 버리고 본문만 씁니다 — 소개문에 「== 생애 ==」가
       그대로 보이면 어색합니다. */
    const body = (name ? seg.split('\n').slice(1).join('\n') : seg);
    const clean = body
      .split('\n')
      .map(s => s.replace(/[ \t\u00a0]+/g, ' ').trim())   /* 줄 안 공백만 정리 */
      .filter(Boolean)
      .join('\n');
    if (clean) out.push(clean);
  }
  return out.join('\n\n').trim();
}

/* 길이 상한에 맞춰 자릅니다 — <b>문단 경계</b>를 지킵니다.
   ★ 왜 문단 경계인가
     글자 수로 딱 자르면 문장 도중에 끊깁니다. 파트너가 본
     「…갈채를 받은 것은 교」가 그런 모습입니다.
     상한을 넘지 않는 마지막 문단까지만 씁니다.
   ★ 첫 문단이 이미 상한을 넘으면 그 문단은 <b>문장 끝에서</b> 자릅니다. */
function cutAtParagraph(txt, limit) {
  const s = String(txt || '');
  if (s.length <= limit) return s;
  const paras = s.split(/\n{2,}/);
  const out = [];
  let n = 0;
  for (const p of paras) {
    if (out.length && n + p.length + 2 > limit) break;
    out.push(p); n += p.length + 2;
  }
  if (out.length) {
    /* 첫 문단만으로 상한을 넘는 경우도 아래에서 다시 다듬습니다 */
    let joined = out.join('\n\n');
    if (joined.length <= limit) return joined;
  }
  /* 한 문단이 너무 길면 문장 끝에서 자릅니다 */
  const head = s.slice(0, limit);
  const m = /[.!?。][^.!?。]*$/.exec(head);
  const cut = m ? head.slice(0, head.length - m[0].length + 1) : head;
  return (cut || head).trim();
}

async function wikiExtracts(host, titles) {
  // 여러 문서를 한 번에 가져옵니다 (도입부만이 아니라 본문까지)
  const p = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', redirects: '1',
    prop: 'extracts', explaintext: '1', titles: titles.join('|')
  });
  try {
    const r = await fetch('https://' + host + '/w/api.php?' + p.toString(), { headers: { 'User-Agent': UA } });
    if (!r.ok) return {};
    const j = await readJson(r);
    const pages = (j.query && j.query.pages) || {};
    const out = {};
    Object.keys(pages).forEach(k => {
      const pg = pages[k];
      if (pg.title && pg.extract) {
        const v = trimWiki(pg.extract);
        if (v) out[pg.title] = v;
      }
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
  /* ★★ 2026-08-18 · <b>숨은 콩쿠르 인물도 봅니다</b> (--with-hidden)
       ─────────────────────────────────────────────────────────
     ★ 무엇이 문제였나
       콩쿠르 입상 기록에서 담은 683명은 <b>hidden</b> 으로 넣었습니다
       (이름밖에 없어 공개할 수 없었습니다). 그런데 이 수집기가
       「hidden=false」 만 보기 때문에 <b>그들에게는 손도 대지
       못했습니다.</b> 채워야 공개할 수 있는데 채워지지 않는 셈입니다.

     ★ 어떻게 하나 — 기본은 그대로 두고(hidden=false),
       <b>--with-hidden</b> 을 주면 <b>숨은 사람까지</b> 봅니다.
       ★ 숨은 사람을 <b>전부</b> 열지 않습니다 — 어드민에서 일부러
         숨긴 사람(잘못 담긴 인물·클래식 무관 인물)이 섞이면
         그들에게 자료를 채우게 됩니다. 그래서
         <b>source='concours' 인 사람만</b> 함께 봅니다.
       ★ 나중에 다른 갈래(kopis-cast 등)도 채우려면 이 자리를
         넓히면 됩니다. */
  const WITH_HIDDEN = process.argv.includes('--with-hidden');
  /* ★ 「or=」와 「and=」를 <b>각각 한 번씩</b> 쓰는 것은 괜찮습니다 —
       PostgREST 가 둘을 and 로 묶습니다. 아래쪽 주석이 걱정한 것은
       「or=」를 <b>두 번</b> 적는 경우입니다(뒤엣것이 앞엣것을 덮음). */
  const HID = !has('hidden') ? ''
    : WITH_HIDDEN
      ? '&or=(hidden.is.false,and(hidden.is.true,source.eq.concours))'
      : '&hidden=is.false';
  if (WITH_HIDDEN) console.log('  · 숨은 콩쿠르 인물도 함께 봅니다 (--with-hidden)');

  // 1) 시대별 era_yr 표기를 DB에서 그대로 배워옵니다 (제가 새 표기를 만들지 않습니다)
  const eraYr = {};
  if (has('era_name') && has('era_yr')) {
    const eraRows = await sbGetAll('persons', 'era_name,era_yr',
      '&era_name=not.is.null&era_yr=not.is.null', 3000);
    eraRows.forEach(r => { if (r.era_name && r.era_yr && !eraYr[r.era_name]) eraYr[r.era_name] = r.era_yr; });
  }
  console.log('  · 시대 표기 학습:', Object.keys(eraYr).join(', ') || '(없음)');

  /* 2) 처리 대상
     ★★ 2026-08-12 v1.3 · <b>소개문이 비어 있는 사람을 먼저</b> 봅니다 ★★
     ────────────────────────────────────────────────────────────────
     ★ 무엇이 문제였나 (파트너 지적)
       예전 차례는 ① 미점검 → ② 오래 전에 점검한 순이었습니다.
       그런데 실측해 보니 —
         이미 점검 표시가 있는 사람   15,213명
         아직 점검 안 된 사람            20명
         <b>점검 표시가 있는데 소개문이 비어 있는 사람  4,652명</b>
       즉 하루 1,500명 가운데 20명만 미점검이고 나머지는 「오래된 순」으로
       뽑히는데, 그 중 소개문이 비어 있는 사람이 섞여 있을 뿐이라
       <b>4,652명을 다 훑는 데 열흘이 걸립니다.</b> 게다가 소개문이 이미
       충실한 사람도 함께 다시 조회해 시간을 씁니다.

     ★ 어떻게 고쳤나 — 차례를 셋으로
       ① 아직 점검 안 된 사람                      (20명)
       ② <b>소개문이 비어 있는 사람</b>              (4,652명) ← 새로 넣음
       ③ 나머지 — 오래 전에 점검한 순               (소개문 늘리기용)
       ②를 먼저 보면 <b>빈 화면부터 채워집니다.</b>

     ★ --only-empty 를 주면 ②만 봅니다 (③을 건너뜁니다).
       빈 것부터 급히 채울 때 씁니다. */
  const ONLY_EMPTY = process.argv.includes('--only-empty');
  /* 소개문이 비어 있다 = 한국어도 영문도 없다
     ★ or 절을 두 번 쓰지 않고 <b>and 하나로 감쌉니다.</b>
       &or=(…)&or=(…) 로 두 번 적으면 PostgREST 판에 따라 뒤엣것이
       앞엣것을 덮을 수 있습니다. 흉내 서버에서는 둘 다 걸렸지만,
       실제 서버에서 다르게 동작하면 <b>엉뚱한 사람을 훑게 됩니다.</b>
       and(or(...),or(...)) 는 한 덩어리라 그런 논란이 없습니다. */
  const EMPTY_DESC = '&and=(or(description.is.null,description.eq.),'
                   +        'or(description_en.is.null,description_en.eq.))';
  let targets = [];
  if (has('wd_checked_at')) {
    /* ① 아직 점검 안 된 사람 */
    targets = await sbGetAll('persons', COLS,
      HID + '&wikidata_id=not.is.null&wd_checked_at=is.null', DAILY_LIMIT);
    console.log('  · ① 미점검:', targets.length, '명');

    /* ② 소개문이 비어 있는 사람 — 점검 표시가 있어도 다시 봅니다 */
    if (targets.length < DAILY_LIMIT) {
      const seen = new Set(targets.map(t => t.id));
      const empty = await sbGetAll('persons', COLS,
        HID + '&wikidata_id=not.is.null' + EMPTY_DESC + '&order=wd_links.desc.nullslast',
        DAILY_LIMIT - targets.length);
      let added = 0;
      empty.forEach(m => { if (!seen.has(m.id)) { targets.push(m); seen.add(m.id); added++; } });
      console.log('  · ② 소개문 비어 있음:', added, '명');
    }

    /* ③ 나머지 — 오래 전에 점검한 순 (소개문을 더 길게 다시 받기) */
    if (!ONLY_EMPTY && targets.length < DAILY_LIMIT) {
      const seen = new Set(targets.map(t => t.id));
      const more = await sbGetAll('persons', COLS,
        HID + '&wikidata_id=not.is.null&wd_checked_at=not.is.null&order=wd_checked_at.asc',
        DAILY_LIMIT - targets.length);
      let added = 0;
      more.forEach(m => { if (!seen.has(m.id)) { targets.push(m); added++; } });
      console.log('  · ③ 오래된 순:', added, '명');
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
  /* ★★ 2026-08-12 v1.3 · 한국어와 영문을 <b>따로</b> 판단합니다 ★★
     ────────────────────────────────────────────────────────────────
     ★ 무엇이 문제였나
       예전에는 이렇게 갈렸습니다 —
         한국어 문서가 있으면 → 한국어만 받고 영문은 <b>아예 안 받음</b>
         한국어 문서가 없고 영문이 있으면 → 영문을 받음
       그래서 한국어 소개가 짧아도 영문을 곁들일 수 없었습니다.
       실측: 한국어 있음 1,720명 · 영문 있음 8,860명.
       화면(SELF PR·인물DB 상세)은 이미 <b>둘을 함께</b> 보여 주도록
       고쳐 두었으므로, 받아 두면 그만큼 쓸모가 있습니다.

     ★ 어떻게 고쳤나
       한국어와 영문을 <b>각각</b> 봅니다. 비어 있는 쪽만 받아 옵니다.
       둘 다 비어 있으면 둘 다 받습니다.

     ★ 문서 제목은 <b>위키데이터가 알려준 주소</b>에서 꺼냅니다(m.koA·m.enA).
       이름으로 찾으면 동명이인에 걸립니다 — 「존 애덤스」는 미국 2대
       대통령도 있습니다. 위키데이터 QID 로 이어진 주소라 그 사람이 맞습니다. */
  function titleOf(url) {
    if (!url) return '';
    const part = String(url).split('/wiki/')[1] || '';
    try { return decodeURIComponent(part).replace(/_/g, ' '); }
    catch (e) { return part.replace(/_/g, ' '); }
  }
  for (const q of qids) {
    const cur = byQid.get(q), m = meta[q] || {};
    /* 틀 코드(|… 나 {…)가 들어온 것은 소개문으로 보지 않습니다 */
    const koBad = isEmpty(cur.description)    || /^[|{]/.test(String(cur.description).trim());
    const enBad = isEmpty(cur.description_en) || /^[|{]/.test(String(cur.description_en).trim());
    if (koBad && m.koA) koJobs.push([titleOf(m.koA), cur]);
    if (enBad && m.enA) enJobs.push([titleOf(m.enA), cur]);
  }
  const grabbed = { ko: 0, en: 0 };
  async function fillFrom(host, jobs, key) {
    for (let i = 0; i < jobs.length; i += CH_WIKI) {
      const slice = jobs.slice(i, i + CH_WIKI);
      const got = await wikiExtracts(host, slice.map(j => j[0]).filter(Boolean));
      slice.forEach(([title, t]) => {
        const txt = got[title];
        /* ★ 2026-08-12 v1.3 · 자르는 길이를 넉넉히 (예전 한국어 400 · 영문 700)
             이것이 소개문이 짧았던 <b>가장 직접적인 원인</b>이었습니다.
             실측: 한국어 소개 평균 249자 · 가장 긴 것 1,758자 ·
             1,000자 넘는 사람이 15,233명 중 <b>한 명</b>.
           ★ 자를 때 <b>문단 경계에서</b> 끊습니다 — 문장 도중에 끊기면
             「…갈채를 받은 것은 교」처럼 됩니다(파트너가 본 그 모습). */
        if (txt && txt.length >= 20) {
          t['_' + key] = cutAtParagraph(txt, key === 'ko' ? MAX_KO : MAX_EN);
          grabbed[key]++;
        }
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
    /* ★ 분야는 소개문을 먼저 봅니다.
       직업 목록만 보면 모차르트(music educator, … composer)가
       「음악교육」이 됩니다. 실제로 그러했습니다. */
    if (isEmpty(cur.field)) {
      const d = decideField({
        description:    patch.description    || cur.description,
        description_en: patch.description_en || cur.description_en,
        wd_occupation:  occNow
      });
      if (d.field) patch.field = d.field;
    }
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
