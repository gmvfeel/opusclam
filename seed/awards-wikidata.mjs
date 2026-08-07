/* ============================================================
   OPUSCLAM 인물 수상·수훈 경력   seed/awards-wikidata.mjs
   2026-08-08

   ══ 이름을 바꿨습니다 — 왜 ════════════════════════════════

   처음 이름은 <b>「콩쿠르 수상자 아카이브」</b> 였습니다.
   1,000명에게 물어보니 이렇게 나왔습니다.

       레지옹 도뇌르 · 레닌 훈장 · People's Artist of the USSR
       할리우드 명예의 거리 스타 · 그래미상 · 구겐하임 펠로십 …

   ★ <b>거의 전부 훈장 · 칭호 · 공로상입니다.</b>
     국내 콩쿠르는 위키데이터에 거의 없습니다.
     그래서 <b>「수상·수훈 경력」</b> 으로 넓혔습니다. 1,000명 가운데
     618명(62%)에게 4,092줄이 있었습니다. 지금 person_awards 는
     <b>두 사람 21건</b>이고 그마저 주최가 전부 빈칸인 시안 자료입니다.

   ★ 국내 콩쿠르 수상자는 <b>따로 갑니다.</b> 국내 8개 대회 ×
     최근 몇 해 × 부문이면 수십 건 규모입니다. 사람이 넣거나
     신고·보강 통로로 모으는 편이 현실적입니다.

   ══ ★ 제가 틀린 것 — 다시 밟지 마십시오 ═══════════════════

   처음 판에서 <b>상 이름으로 종류를 판정했습니다.</b>
       · 이름에 prize · award 가 있으면 콩쿠르로 셈
         → 「Stalin Prize」 가 콩쿠르가 됐습니다
       · 우리 콩쿠르 이름 조각으로 맞춤
         → 낱말 'aria' 가 <b>Bav-aria-n</b> Maximilian Order 에 걸려
           훈장이 「우리 콩쿠르」 로 표시됐습니다
     그렇게 세니 1,148줄이 「콩쿠르로 보임」 이었는데 실제 콩쿠르는
     거의 없었습니다.

   ▶ <b>이름 문자열로 종류를 판정하지 마십시오.</b>
     지금은 <b>위키데이터에 상 자체의 종류(P31)를 물어봅니다.</b>
     「이것은 훈장이다 / 음악 콩쿠르다」 를 위키데이터가 말해 줍니다.

   ══ 무엇을 물어보나 ═══════════════════════════════════════

     P166  받은 상          ← p:/ps:/pq: 형태로 물어야
     P585  받은 때            <b>연도가 함께</b> 옵니다
     P1027 수여한 곳
     P31   <b>상의 종류</b>   ← 갈래를 정하는 근거

   ══ 담는 방식 ═════════════════════════════════════════════

   ★ 표에 직접 넣지 않고 <b>oc_award_upsert() 함수</b>를 부릅니다.
     2026-08-08 에 PostgREST 의 on_conflict + merge-duplicates 로
     보냈다가 <b>보내지 않은 칸이 전부 null 로 덮이는</b> 사고가
     있었습니다(1,998건 실패 · not-null 제약이 자료를 살렸습니다).
   ★ 이미 있는 줄은 <b>비어 있는 칸만</b> 채웁니다. 사람이 손으로
     적어 둔 값을 자동수집이 덮지 않습니다.
   ★ 고유 키에 <b>연도까지</b> 넣습니다. 같은 상을 여러 해 받은 것을
     따로 담아야 합니다(쇼스타코비치가 스탈린상을 여섯 번 받았습니다).

   ── 쓰는 법 ──────────────────────────────────────────────
     node seed/awards-wikidata.mjs                담지 않고 봅니다(기본)
     node seed/awards-wikidata.mjs --save         실제로 담습니다
     node seed/awards-wikidata.mjs --limit=500
     node seed/awards-wikidata.mjs --kr           한국 인물만
     node seed/awards-wikidata.mjs --redo         이미 담긴 인물도 다시
     node seed/awards-wikidata.mjs --debug        한 줄씩 자세히

   ★ 기본이 「담지 않기」 입니다. 담으려면 --save 를 주어야 합니다.
     실수로 담기는 쪽이 아니라 실수로 안 담기는 쪽으로 기울였습니다.

   ── 선행 조건 ────────────────────────────────────────────
     ★ 13-RUN-NOW-awards-schema.sql 을 먼저 실행하셔야 합니다.
       칸과 갈래표와 담는 함수가 거기서 생깁니다.

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
/* ★ 기본이 --dry 입니다. 담으려면 --save 를 주어야 합니다.
     2026-08-08 에 담기로 사고를 한 번 냈으므로, 실수로 담기는 쪽이
     아니라 <b>실수로 안 담기는 쪽</b>으로 기울여 둡니다. */
const DRY   = !args.save;
const REDO  = !!args.redo;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 3000;
const BATCH = Number(args.batch) > 0 ? Number(args.batch) : 120;

const WDQS = 'https://query.wikidata.org/sparql';
const UA   = 'OpusclamAwardBot/1.0 (https://opusclam.com)';

/* ── 갈래표는 <b>DB 에</b> 있습니다 — oc_award_kinds ────────

   ★ 2026-08-08 처음 판에서 <b>상 이름으로 종류를 판정했다가
     틀렸습니다.</b> 적어 둡니다.

       이름에 prize · award 가 있으면 콩쿠르로 세었더니
       「Stalin Prize」 가 콩쿠르가 됐습니다.
       「Bavarian Maximilian Order」 가 우리 콩쿠르로 표시된 것은
       제가 넣은 낱말 'aria' 가 <b>Bav-aria-n</b> 에 걸린 탓입니다.
       그렇게 세니 1,148줄이 「콩쿠르로 보임」 이었는데
       <b>실제 콩쿠르는 거의 없었습니다.</b>

   ★ 그래서 이름을 보지 않습니다. <b>위키데이터에 상 자체의
     종류(P31)를 물어봅니다.</b> 「이것은 훈장이다 / 음악
     콩쿠르다」 를 위키데이터가 직접 말해 줍니다.

   ★ 그 종류 이름을 갈래로 옮기는 표는 <b>DB 에</b> 둡니다
     (oc_award_kinds). 표에 없으면 갈래가 other 로 남고 원문이
     그대로 담깁니다. 늘릴 때는 <b>SQL 한 줄</b>이면 되고 이 파일을
     고칠 일이 없습니다.
     ▶ 13-RUN-NOW-awards-schema.sql 을 먼저 실행하셔야 합니다. */
let KINDS = {};        /* kind_raw → { kind, ko } */

async function loadKinds() {
  const rows = await getAll('oc_award_kinds?select=kind_raw,kind,kind_ko');
  KINDS = {};
  for (const r of rows) {
    KINDS[String(r.kind_raw || '').trim().toLowerCase()] = {
      kind: String(r.kind || 'other'),
      ko  : (r.kind_ko == null ? null : String(r.kind_ko))
    };
  }
  return rows.length;
}

/* 여러 종류가 올 때 <b>어느 것을 고르나</b>
   ★ 한 상이 「훈장」 이면서 「기사단」 일 수 있습니다.
     아래 순서로 고릅니다 — 구체적인 것이 앞입니다. */
const KIND_RANK = {
  competition: 1, order: 2, prize: 3, fellowship: 4, honorary: 5, other: 6
};

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

  const all = await getAll(q, LIMIT * 2);

  /* ★ 이미 수상이 담긴 인물은 건너뜁니다.
       2026-08-07 함정 16번 — 처리한 대상을 제외하지 않으면 몇 번을
       돌려도 <b>같은 사람만 되풀이</b>합니다(작품 수집에서 상위 30명만
       반복하던 일). --redo 를 주면 다시 물어봅니다. */
  let done = new Set();
  if (!REDO) {
    const got = await getAll(
      'person_awards?select=person_id&source=eq.wikidata&order=person_id.asc');
    for (const r of got) done.add(Number(r.person_id));
    if (done.size) {
      console.log(`   이미 수상이 담긴 인물 ${done.size}명은 건너뜁니다`);
    }
  }

  const out = [];
  for (const p of all) {
    if (!REDO && done.has(Number(p.id))) continue;
    out.push(p);
    if (out.length >= LIMIT) break;
  }
  return out;
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
  /* ★ P585(시점)은 <b>한정어</b>로 붙습니다. 그래서 wdt:P166 이 아니라
       p:P166 / ps: / pq: 형태로 물어야 연도가 함께 옵니다.
     ★ 2026-08-08 추가 — 상 자체의 종류(P31)를 함께 받습니다.
       이름으로 종류를 판정하다가 틀렸기 때문입니다. */
  const query = `
SELECT ?p ?award ?awEn ?awKo ?when ?byEn ?kEn WHERE {
  VALUES ?p { ${values} }
  ?p p:P166 ?st .
  ?st ps:P166 ?award .
  OPTIONAL { ?st pq:P585 ?when . }
  OPTIONAL { ?award rdfs:label ?awEn . FILTER(lang(?awEn) = "en") }
  OPTIONAL { ?award rdfs:label ?awKo . FILTER(lang(?awKo) = "ko") }
  OPTIONAL {
    ?award wdt:P1027 ?byWhom .
    ?byWhom rdfs:label ?byEn . FILTER(lang(?byEn) = "en")
  }
  OPTIONAL {
    ?award wdt:P31 ?kind .
    ?kind rdfs:label ?kEn . FILTER(lang(?kEn) = "en")
  }
}
LIMIT ${qids.length * 40}`;

  const rows = await sparql(query);
  if (rows === null) return null;

  /* ★ 한 수상에 종류가 여러 개 오면 줄이 늘어납니다.
       그래서 <b>수상 하나로 모으고</b> 종류만 여러 개 담습니다.
       열쇠는 인물+상+연도입니다 — 같은 상을 여러 해 받은 것을
       따로 세어야 합니다(쇼스타코비치 스탈린상 여섯 번). */
  const bag = new Map();
  for (const b of rows) {
    const pQid = String(b.p.value).split('/').pop();
    const aQid = String(b.award.value).split('/').pop();
    const when = b.when ? String(b.when.value).slice(0, 4) : '';
    const key  = pQid + '|' + aQid + '|' + when;
    let r = bag.get(key);
    if (!r) {
      r = {
        personQid: pQid,
        awardQid : aQid,
        awEn     : b.awEn ? String(b.awEn.value).trim() : '',
        awKo     : b.awKo ? String(b.awKo.value).trim() : '',
        when     : when,
        byEn     : b.byEn ? String(b.byEn.value).trim() : '',
        kinds    : []
      };
      bag.set(key, r);
    }
    if (b.kEn) {
      const k = String(b.kEn.value).trim();
      if (k && r.kinds.indexOf(k) < 0) r.kinds.push(k);
    }
    /* 라벨·기관이 뒤 줄에서 올 수도 있으므로 비어 있으면 채웁니다 */
    if (!r.awEn && b.awEn) r.awEn = String(b.awEn.value).trim();
    if (!r.awKo && b.awKo) r.awKo = String(b.awKo.value).trim();
    if (!r.byEn && b.byEn) r.byEn = String(b.byEn.value).trim();
  }
  return [...bag.values()];
}

/* ★ 여러 종류 가운데 가장 알맞은 것을 고릅니다.
     갈래표에 있는 것을 먼저, 그 가운데 구체적인 것(콩쿠르)을 앞으로. */
function pickKind(kinds) {
  if (!kinds || !kinds.length) return null;
  let best = null, bestRank = 99;
  for (const raw of kinds) {
    const e = KINDS[String(raw).trim().toLowerCase()];
    const r = e ? (KIND_RANK[e.kind] || 9) : 8;   /* 표에 없으면 뒤로 */
    if (r < bestRank) { best = raw; bestRank = r; }
  }
  return best || kinds[0];
}

/* ── 담기 ─────────────────────────────────────────────────
   ★ 표에 직접 넣지 않고 <b>함수를 부릅니다.</b>
     2026-08-08 에 PostgREST 의 on_conflict + merge-duplicates 로
     보냈다가 <b>보내지 않은 칸이 전부 null 로 덮이는</b> 사고가
     있었습니다(1,998건 실패, not-null 제약이 자료를 살렸습니다).
     함수 안에서 적은 칸만 다루면 그런 일이 없습니다. */
async function saveRows(rows) {
  let ok = 0;
  const fail = [];
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    try {
      const r = await sbPost('rpc/oc_award_upsert', { p_rows: part });
      ok += (typeof r === 'number' ? r : part.length);
    } catch (e) {
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 건씩 다시 담습니다`);
      console.log(`    (${e.message})`);
      for (const one of part) {
        try {
          const r2 = await sbPost('rpc/oc_award_upsert', { p_rows: [one] });
          ok += (typeof r2 === 'number' ? r2 : 1);
        } catch (e2) {
          fail.push({ id: one.source_id, why: e2.message });
        }
      }
    }
  }
  return { ok, fail };
}

async function sbPost(path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function main() {
  console.log('══ 인물 수상·수훈 경력 수집 ══');
  console.log(DRY ? '※ 담지 않습니다 — 무엇이 오는지만 봅니다'
                  : '※ 실제로 담습니다');
  console.log(`   인물 최대 ${LIMIT}명 · 한 묶음 ${BATCH}명`);
  if (KR)   console.log('   한국 인물만 봅니다');
  if (REDO) console.log('   이미 수상이 담긴 인물도 다시 물어봅니다');
  console.log('');

  /* 갈래표를 DB 에서 읽습니다 */
  const nk = await loadKinds();
  if (!nk) {
    console.log('★ 갈래표(oc_award_kinds)가 비어 있습니다.');
    console.log('  13-RUN-NOW-awards-schema.sql 을 먼저 실행해 주십시오.');
    return;
  }
  console.log(`갈래표 ${nk}가지를 읽었습니다`);

  const people = await pickPeople();
  if (!people.length) {
    console.log('대상이 없습니다.');
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
  const kindCount  = new Map();   /* 갈래 → 몇 줄 */
  const noKind     = new Map();   /* 갈래표에 없는 종류 */
  const rows = [];                /* 담을 것 */
  let rowsAll = 0, withYear = 0, withKo = 0, withBy = 0, noKindRaw = 0;
  const peopleWith = new Set();
  const compSamples = [];

  for (let i = 0; i < qids.length; i += BATCH) {
    const part = qids.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(qids.length / BATCH);
    console.log(`── 묶음 ${n}/${total} : 인물 ${part.length}명`);

    const got = await fetchAwards(part);
    if (got === null) { await sleep(3000); continue; }

    for (const r of got) {
      const p = byQid.get(r.personQid);
      if (!p) continue;

      /* ★ 이름이 없으면 버립니다. 「(Q12345)」 를 화면에 보일 수는
         없습니다. 지어내지 않는다는 원칙과 같습니다. */
      const title = r.awEn || r.awKo;
      if (!title) continue;

      rowsAll += 1;
      peopleWith.add(r.personQid);
      const shown = r.awKo || r.awEn;
      awardCount.set(shown, (awardCount.get(shown) || 0) + 1);
      if (r.when) withYear += 1;
      if (r.awKo) withKo += 1;
      if (r.byEn) withBy += 1;

      const kindRaw = pickKind(r.kinds);
      if (!kindRaw) noKindRaw += 1;
      const ent = kindRaw ? KINDS[String(kindRaw).trim().toLowerCase()] : null;
      const kind = ent ? ent.kind : 'other';
      kindCount.set(kind, (kindCount.get(kind) || 0) + 1);
      if (kindRaw && !ent) noKind.set(kindRaw, (noKind.get(kindRaw) || 0) + 1);

      /* ★ 콩쿠르는 따로 표본을 모읍니다 — 이것이 원래 찾던 것입니다 */
      if (kind === 'competition' && compSamples.length < 30) {
        compSamples.push({
          who: (p.name_ko || p.name_en), what: shown,
          when: r.when || '(연도 없음)', by: r.byEn || ''
        });
      }

      /* ★ 고유 키에 <b>연도까지</b> 넣습니다. 같은 상을 여러 해
         받은 것을 따로 담아야 합니다(쇼스타코비치 스탈린상 6번). */
      rows.push({
        person_id: p.id,
        title    : r.awEn || r.awKo,
        title_ko : (r.awKo && r.awKo !== r.awEn) ? r.awKo : null,
        year     : r.when ? Number(r.when) : null,
        year_text: r.when || null,
        org      : r.byEn || null,
        award_qid: r.awardQid,
        kind_raw : kindRaw || null,
        source_id: `wd:${r.personQid}-${r.awardQid}-${r.when || '0'}`
      });

      if (DEBUG) {
        console.log(`   ${(p.name_ko || p.name_en)} — ${shown}`
                  + `${r.when ? ' (' + r.when + ')' : ''}`
                  + ` [${kind}${kindRaw ? ' / ' + kindRaw : ''}]`);
      }
    }
    await sleep(1200);
  }

  console.log('');
  console.log('══ 갈래별 ══');
  const KIND_KO_LOG = {
    competition: '콩쿠르  ★ 원래 찾던 것',
    order      : '훈장 · 기사단',
    prize      : '공로상',
    fellowship : '회원 · 펠로십',
    honorary   : '명예직 · 칭호',
    other      : '갈래를 정하지 못함'
  };
  for (const k of ['competition','order','prize','fellowship','honorary','other']) {
    const v = kindCount.get(k);
    if (!v) continue;
    console.log(`  ${String(v).padStart(6)}  ${KIND_KO_LOG[k]}`);
  }

  if (compSamples.length) {
    console.log('');
    console.log('══ 콩쿠르 표본 ══');
    for (const s of compSamples) {
      console.log(`  ${s.who} — ${s.what} · ${s.when}${s.by ? ' · ' + s.by : ''}`);
    }
  }

  console.log('');
  console.log('══ 받은 상 — 많은 것부터 30가지 ══');
  const sorted = [...awardCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted.slice(0, 30)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
  if (sorted.length > 30) console.log(`  … 그 밖 ${sorted.length - 30}가지`);

  if (noKind.size) {
    console.log('');
    console.log('★ 갈래표에 없는 종류 — 이것을 알려 주십시오');
    console.log('  (갈래가 other 로 담기고, 뒤에 SQL 한 줄로 채울 수 있습니다)');
    const nt = [...noKind.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of nt.slice(0, 40)) {
      console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    if (nt.length > 40) console.log(`  … 그 밖 ${nt.length - 40}가지`);
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  대상 인물               ${people.length}명`);
  console.log(`  상이 하나라도 있는 인물 ${peopleWith.size}명`);
  console.log(`  담을 수상 줄            ${rows.length}줄`);
  console.log(`  상 가지수               ${awardCount.size}가지`);
  console.log(`  ── 그 가운데 ──`);
  console.log(`  연도가 있는 것          ${withYear}줄`);
  console.log(`  한국어 이름이 있는 것   ${withKo}줄`);
  console.log(`  수여 기관이 있는 것     ${withBy}줄`);
  console.log(`  상의 종류가 없는 것     ${noKindRaw}줄`);

  if (DRY) {
    console.log('');
    console.log('※ --dry 이므로 담지 않았습니다.');
    return;
  }
  if (!rows.length) {
    console.log('');
    console.log('담을 것이 없습니다.');
    return;
  }

  console.log('');
  console.log(`── 담습니다 : ${rows.length}줄 ──`);
  const { ok, fail } = await saveRows(rows);
  console.log(`  담김 ${ok}줄${fail.length ? ` · 실패 ${fail.length}줄` : ''}`);
  if (fail.length) {
    console.log('  ★ 담지 못한 것:');
    for (const f of fail.slice(0, 15)) console.log(`    · ${f.id} — ${f.why}`);
    if (fail.length > 15) console.log(`    … 그 밖 ${fail.length - 15}줄`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
