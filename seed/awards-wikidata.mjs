/* ============================================================
   OPUSCLAM 콩쿠르 수상 — 무엇이 오는지 보기
   seed/awards-wikidata.mjs
   2026-08-08

   ══ 이 판은 <b>담지 않습니다</b> ═══════════════════════════

   ★ 일부러 담는 기능을 넣지 않았습니다.
     오늘 위키데이터 P31(작품 형식)을 두고 「클래식 작품에는 잘
     채워져 있을 것」 이라 짐작했다가 <b>전제가 두 번 무너졌습니다</b>
     (2,000개 중 69%가 「음악 작품」 이라는 넓은 말뿐이었습니다).

     수상 기록(P166)도 <b>얼마나 있는지 모릅니다.</b>
     담는 코드를 먼저 만들면, 쓸모없다고 밝혀졌을 때 그 코드가
     그대로 버려집니다. <b>먼저 보고 나서 만듭니다.</b>

   ══ 무엇을 물어보나 ═══════════════════════════════════════

   인물DB 의 위키데이터 번호로 <b>P166(받은 상)</b> 을 물어봅니다.
   함께 받는 것 —
       · 상의 이름 (영어 · 한국어)
       · 상을 받은 <b>때</b>          P585(시점)
       · 어느 <b>대회·기관</b> 인지    P1027(수여) · P166 의 한정어
       · 상의 <b>부문·등수</b>        P1346 등은 오지 않을 수 있습니다

   ★ 무엇이 오는지 모르므로 <b>넓게 물어보고 분포를 셉니다.</b>

   ══ 왜 이것이 값이 있나 ═══════════════════════════════════

   국내 콩쿠르 수상 기록은 어디에도 정리돼 있지 않습니다.
   수상자를 인물DB 와 이으면 <b>한국 음악계 인물의 경력이 추적</b>
   됩니다. 다만 위키데이터는 <b>국제 콩쿠르</b> 쪽이 잘 채워져
   있을 것이고, 국내 대회는 거의 없을 가능성이 높습니다.
   그것을 확인하는 것이 이 파일의 목적입니다.

   쓰는 법
     node seed/awards-wikidata.mjs                기본 (인물 3000명)
     node seed/awards-wikidata.mjs --limit=500
     node seed/awards-wikidata.mjs --kr           한국 인물만
     node seed/awards-wikidata.mjs --debug        받은 값을 자세히

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const DEBUG = !!args.debug;
const KR    = !!args.kr;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 3000;
const BATCH = Number(args.batch) > 0 ? Number(args.batch) : 120;

const WDQS = 'https://query.wikidata.org/sparql';
const UA   = 'OpusclamAwardBot/1.0 (https://opusclam.com)';

/* ── 우리가 아는 콩쿠르 이름 ──────────────────────────────
   ★ seed/concours-seed.mjs 에 담아 둔 28개입니다.
     받은 상 이름 가운데 <b>우리 콩쿠르와 이어지는 것이 몇 개인지</b>
     세기 위한 것입니다. 이것이 적으면 이 작업의 값이 낮습니다.
   ★ 이름을 <b>짐작해서 늘리지 않습니다.</b> 실제 씨앗 파일에 있는
     것만 적었습니다.                                          */
const OURS = [
  /* 국내 5 */
  '동아음악콩쿠르', '중앙음악콩쿠르', '통영국제음악제', '성악', '작곡',
  /* 해외 — 널리 알려진 이름 조각으로 맞춥니다 */
  'chopin', 'cliburn', 'leeds', 'busoni', 'queen elisabeth',
  'tchaikovsky', 'sibelius', 'paganini', 'geneva', 'munich',
  'aria', 'enescu', 'rubinstein', 'montreal', 'hamamatsu',
  'long-thibaud', 'clara haskil', 'gina bachauer', 'van cliburn',
  'indianapolis', 'wieniawski', 'dvorak', 'bach'
];

async function sb(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ── 나눠 받기 ────────────────────────────────────────────
   ★ PostgREST 는 한 번에 200개까지만 줍니다. 끝냄은 0개일 때만,
     offset 은 실제로 받은 수만큼. order 에 흔들리지 않는 칸을.
     2026-08-08 에 이 함정을 네 번 밟았습니다.              */
async function getAll(base, max) {
  const PAGE = 200;
  const cap = (max && max > 0) ? max : Infinity;
  const out = [];
  let off = 0;
  while (out.length < cap) {
    const want = Math.min(PAGE, cap - out.length);
    const rows = await sb(`${base}&limit=${want}&offset=${off}`);
    if (!rows || !rows.length) break;
    out.push(...rows);
    off += rows.length;
  }
  return out;
}

/* 위키데이터는 붐빌 때 429 · 500 을 돌려줍니다. 네 번까지 다시 묻습니다. */
async function sparql(query) {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(query)}`;
  for (let t = 1; t <= 4; t++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA }
      });
      if (res.ok) {
        const j = await res.json();
        return (j.results && j.results.bindings) || [];
      }
      console.log(`    · 위키데이터 응답 ${res.status} — ${t}/4 다시 시도`);
    } catch (e) {
      console.log(`    · 통신 오류 — ${t}/4 다시 시도 (${e.message})`);
    }
    await sleep(2000 * t);
  }
  console.log('    ✗ 이 묶음은 건너뜁니다');
  return null;
}

/* ── 대상 인물 뽑기 ────────────────────────────────────── */
async function pickPeople() {
  let q = 'persons?select=id,name_ko,name_en,wikidata_id,nationality,era_name'
        + '&wikidata_id=not.is.null'
        + '&hidden=not.is.true'
        + '&order=id.asc';
  /* ★ 나라 칸 이름은 <b>nationality</b> 입니다. country 가 아닙니다.
       db/person.html 의 renderRow 에서 p.nationality 를 쓰는 것을
       확인했습니다(1019줄). 짐작으로 country 를 썼다가 고쳤습니다.
     ★ 값이 「대한민국」 인 것을 화면에서 보았으므로 그것으로 맞춥니다.
       'Korea' 도 함께 봅니다 — 자동수집이 영문으로 넣었을 수 있습니다. */
  if (KR) q += '&or=(nationality.ilike.*한국*,nationality.ilike.*Korea*)';
  return getAll(q, LIMIT);
}

/* ── 수상 물어보기 ────────────────────────────────────────
   ★ 라벨을 영어와 한국어 <b>둘 다</b> 받습니다. 한국어가 있으면
     그대로 쓸 수 있습니다(작품에서 「왕궁의 불꽃놀이 음악」 처럼
     한국어 라벨이 잘 채워진 경우가 있었습니다).
   ★ P585(시점)은 한정어로 붙습니다. 그래서 <b>p:P166 / ps: / pq:</b>
     형태로 물어봐야 때를 함께 받을 수 있습니다.
     wdt:P166 으로만 물으면 상 이름만 오고 연도가 오지 않습니다.  */
async function fetchAwards(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const query = `
SELECT ?p ?award ?awEn ?awKo ?when ?byWhom ?byEn WHERE {
  VALUES ?p { ${values} }
  ?p p:P166 ?st .
  ?st ps:P166 ?award .
  OPTIONAL { ?st pq:P585 ?when . }
  OPTIONAL { ?award rdfs:label ?awEn . FILTER(lang(?awEn) = "en") }
  OPTIONAL { ?award rdfs:label ?awKo . FILTER(lang(?awKo) = "ko") }
  OPTIONAL {
    ?award wdt:P1027 ?byWhom .
    OPTIONAL { ?byWhom rdfs:label ?byEn . FILTER(lang(?byEn) = "en") }
  }
}
LIMIT ${qids.length * 20}`;

  const rows = await sparql(query);
  if (rows === null) return null;

  const out = [];
  for (const b of rows) {
    out.push({
      personQid: String(b.p.value).split('/').pop(),
      awardQid : String(b.award.value).split('/').pop(),
      awEn     : b.awEn ? String(b.awEn.value).trim() : '',
      awKo     : b.awKo ? String(b.awKo.value).trim() : '',
      when     : b.when ? String(b.when.value).slice(0, 4) : '',
      byEn     : b.byEn ? String(b.byEn.value).trim() : ''
    });
  }
  return out;
}

/* 우리가 담아 둔 콩쿠르와 이어지는지 — 느슨하게 맞춰 봅니다 */
function isOurs(name) {
  const s = String(name || '').toLowerCase();
  if (!s) return false;
  return OURS.some(function (k) {
    const kk = String(k).toLowerCase();
    return kk.length >= 3 && s.indexOf(kk) >= 0;
  });
}

/* 콩쿠르처럼 보이는 이름인지 — 훈장 · 명예직과 가르기 위해 */
function looksLikeCompetition(name) {
  const s = String(name || '').toLowerCase();
  if (!s) return false;
  return /competition|concours|concorso|wettbewerb|콩쿠르|콩쿨|음악제|prize|award/.test(s);
}

async function main() {
  console.log('══ 콩쿠르 수상 — 무엇이 오는지 보기 ══');
  console.log('※ 담지 않습니다. 이 판에는 담는 기능이 없습니다.');
  console.log(`   인물 최대 ${LIMIT}명 · 한 묶음 ${BATCH}명`);
  if (KR) console.log('   한국 인물만 봅니다');
  console.log('');

  const people = await pickPeople();
  if (!people.length) {
    console.log('대상이 없습니다. 위키데이터 번호가 있는 인물이 없습니다.');
    return;
  }
  console.log(`대상 인물 ${people.length}명`);
  console.log('');

  const byQid = new Map();
  for (const p of people) {
    const k = String(p.wikidata_id).trim();
    if (!byQid.has(k)) byQid.set(k, p);
  }
  const qids = [...byQid.keys()];

  /* 셈 */
  const awardCount = new Map();   /* 상 이름 → 몇 번 */
  const koCount    = new Map();   /* 한국어 라벨이 있는 상 */
  let rowsAll = 0, withYear = 0, withKo = 0, withBy = 0;
  let compRows = 0, oursRows = 0;
  const peopleWith = new Set();
  const samples = [];

  for (let i = 0; i < qids.length; i += BATCH) {
    const part = qids.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(qids.length / BATCH);
    console.log(`── 묶음 ${n}/${total} : 인물 ${part.length}명`);

    const got = await fetchAwards(part);
    if (got === null) { await sleep(3000); continue; }

    for (const r of got) {
      rowsAll += 1;
      peopleWith.add(r.personQid);
      const name = r.awKo || r.awEn || ('(' + r.awardQid + ')');
      awardCount.set(name, (awardCount.get(name) || 0) + 1);
      if (r.when) withYear += 1;
      if (r.awKo) { withKo += 1; koCount.set(name, (koCount.get(name) || 0) + 1); }
      if (r.byEn) withBy += 1;

      const isComp = looksLikeCompetition(r.awEn) || looksLikeCompetition(r.awKo);
      if (isComp) compRows += 1;
      if (isOurs(r.awEn) || isOurs(r.awKo)) oursRows += 1;

      if (samples.length < 25 && isComp) {
        const p = byQid.get(r.personQid);
        samples.push({
          who : (p ? (p.name_ko || p.name_en) : r.personQid),
          what: name,
          when: r.when || '(연도 없음)',
          by  : r.byEn || ''
        });
      }
      if (DEBUG) {
        const p = byQid.get(r.personQid);
        console.log(`   ${(p ? (p.name_ko || p.name_en) : r.personQid)}`
                  + ` — ${name}${r.when ? ' (' + r.when + ')' : ''}`
                  + `${r.byEn ? ' · ' + r.byEn : ''}`);
      }
    }
    await sleep(1200);
  }

  console.log('');
  console.log('══ 받은 상 — 많은 것부터 40가지 ══');
  const sorted = [...awardCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted.slice(0, 40)) {
    const mark = (isOurs(k) ? ' ★우리 콩쿠르'
                : looksLikeCompetition(k) ? ' · 콩쿠르로 보임' : '');
    console.log(`  ${String(v).padStart(5)}  ${k}${mark}`);
  }
  if (sorted.length > 40) console.log(`  … 그 밖 ${sorted.length - 40}가지`);

  if (samples.length) {
    console.log('');
    console.log('══ 콩쿠르로 보이는 것 표본 ══');
    for (const s of samples) {
      console.log(`  ${s.who} — ${s.what} · ${s.when}${s.by ? ' · ' + s.by : ''}`);
    }
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  대상 인물              ${people.length}명`);
  console.log(`  상이 하나라도 있는 인물 ${peopleWith.size}명`);
  console.log(`  받은 수상 줄            ${rowsAll}줄`);
  console.log(`  상 가지수               ${awardCount.size}가지`);
  console.log(`  ── 그 가운데 ──`);
  console.log(`  연도가 있는 것          ${withYear}줄`);
  console.log(`  한국어 이름이 있는 것   ${withKo}줄`);
  console.log(`  수여 기관이 있는 것     ${withBy}줄`);
  console.log(`  콩쿠르로 보이는 것      ${compRows}줄`);
  console.log(`  ★ 우리 콩쿠르와 이어짐  ${oursRows}줄`);

  console.log('');
  console.log('※ 담지 않았습니다. 위 숫자를 알려 주십시오.');
  console.log('  「콩쿠르로 보이는 것」 과 「연도가 있는 것」 이 적으면');
  console.log('  이 방식으로는 값이 낮습니다. 그때는 다른 길을 찾습니다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
