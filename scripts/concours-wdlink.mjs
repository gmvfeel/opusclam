#!/usr/bin/env node
/* ============================================================
   콩쿠르에서 담은 인물에 <b>위키데이터 번호</b>를 찾아 붙입니다
   scripts/concours-wdlink.mjs                    2026-08-18
   ------------------------------------------------------------
   ★ 왜 필요한가
     오늘 콩쿠르 입상 기록에서 683명을 인물DB 에 담았지만
     <b>사진·생몰년·나라가 모두 비어</b> 있습니다. 이미 있는 보강
     수집기(enrich-persons)는 <b>위키 번호가 있는 사람만</b> 보므로
     이들에게는 손도 대지 못합니다.
     번호가 붙으면 그다음은 그 수집기가 다 해 줍니다.

   ★ 어떻게 찾나 — <b>두 단계</b>로, 확실한 것부터
       1단계  이름이 같고 <b>그 콩쿠르 수상 기록이 위키데이터에도</b>
              있는 사람 → 거의 틀림없습니다
       2단계  이름이 같고 <b>직업이 음악 쪽</b>이며 후보가 하나뿐
     후보가 여럿이면 <b>건드리지 않습니다.</b>

   ★ 왜 이렇게 좁히나 — 이름만으로 찾으면 위험합니다.
     「Sean Chen」에는 피아니스트·배우·운동선수가 있습니다. 한 번
     잘못 붙으면 그 사람의 사진과 생몰년이 <b>통째로 남의 것</b>이
     됩니다. 수를 얻기보다 <b>틀리지 않는 것</b>이 낫습니다.

   ★ --dry 를 주면 <b>아무것도 담지 않고</b> 짝만 보여 줍니다.
     처음에는 반드시 --dry 로 눈으로 확인하십시오.

   쓰는 법
     node scripts/concours-wdlink.mjs --dry
     node scripts/concours-wdlink.mjs --dry --limit=80
     node scripts/concours-wdlink.mjs --save
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 필요합니다'); process.exit(1); }

const ARGS = {};
process.argv.slice(2).forEach((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) ARGS[m[1]] = m[2] === undefined ? true : m[2];
});
const DRY   = !ARGS.save;
const LIMIT = Math.min(+ARGS.limit || 2000, 2000);

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OPUSCLAM/1.0 (https://opusclam.com) concours-wdlink';
const HDR = {
  apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...HDR, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} — ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
   받은 수만큼 offset 을 밀고, 0줄일 때 끝냅니다. */
async function sbAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await sb(`${path}&limit=200&offset=${off}`);
    if (!rows || !rows.length) break;
    out.push(...rows);
    off += rows.length;
    if (out.length >= LIMIT) break;
  }
  return out.slice(0, LIMIT);
}

async function sparql(q, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(q)}`, {
        headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 160)}`);
      const d = await r.json();
      return (d.results && d.results.bindings) || [];
    } catch (e) {
      if (i === tries) throw e;
      console.log(`   위키데이터가 답하지 않습니다(${e.message}) — ${i * 5}초 뒤 다시`);
      await sleep(i * 5000);
    }
  }
  return [];
}

/* 이름 열쇠 — 낱말을 가나다순으로 늘어놓고 붙입니다.
   ★ 「Lim Ji-young」과 「Ji Young Lim」이 같은 열쇠가 됩니다.
     콩쿠르 기록과 위키데이터의 차례가 다를 수 있습니다.
   ★★ <b>악센트를 벗깁니다</b> — 「José Feghali」와 「Jose Feghali」가
     달라져 못 찾습니다(시험에서 잡음). 위키데이터는 악센트를 쓰고
     콩쿠르 기록은 빠진 표기가 섞여 옵니다. */
function key(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   /* 악센트 벗기기 */
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(Boolean).sort().join('');
}

/* ── 음악 쪽 직업 (위키데이터 QID) ──────────────────────────
   ★ 이 가운데 하나라도 있어야 사람으로 인정합니다. 배우·운동선수
     같은 동명이인을 걸러내는 그물입니다. */
const JOB = [
  'Q639669',   // 음악가
  'Q36834',    // 작곡가
  'Q486748',   // 피아니스트
  'Q1259917',  // 바이올리니스트
  'Q13219587', // 첼리스트
  'Q2865819',  // 오페라 성악가
  'Q177220',   // 가수
  'Q158852',   // 지휘자
  'Q1622272',  // 대학교수 (음악원 교수)
  'Q1198887',  // 음악 교육자
  'Q753110',   // 작곡가(songwriter)
  'Q3455803',  // 감독? — 넣지 않습니다
].filter((q) => q !== 'Q3455803');

async function main() {
  console.log('■ 콩쿠르 인물 ↔ 위키데이터 잇기');
  console.log(`   ${DRY ? '시험 실행 — 아무것도 담지 않습니다' : '실제로 담습니다 (--save)'} · 한도 ${LIMIT}명`);

  /* ── ① 대상 뽑기 ──────────────────────────────────────── */
  const rows = await sbAll(
    'persons?select=id,name_ko,name_en,nationality,description'
    + '&source=eq.concours&wikidata_id=is.null&order=id'
  );
  console.log(`   대상 ${rows.length}명 (콩쿠르에서 담고 위키 번호가 없는 사람)`);
  if (!rows.length) return;

  /* 영문 이름이 있어야 위키데이터에서 찾을 수 있습니다 */
  const cand = rows.filter((r) => /[A-Za-z]/.test(r.name_en || ''));
  console.log(`   그 가운데 영문 이름이 있는 사람 ${cand.length}명`);

  const byKey = new Map();
  cand.forEach((r) => {
    const k = key(r.name_en);
    if (!k) return;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  });

  /* ── ② 위키데이터에 묻기 ──────────────────────────────── */
  /*  ★ 한 번에 다 물으면 시간이 넘칩니다. 이름을 <b>묶음으로</b>
        나눠 묻습니다. 60개씩이면 질의가 넉넉히 돌아갑니다. */
  const names = [...new Set(cand.map((r) => (r.name_en || '').trim()).filter(Boolean))];
  console.log(`   위키데이터에 물어볼 이름 ${names.length}개`);

  const found = new Map();   /* 이름열쇠 → [{qid, label, jobs, awards}] */
  const CHUNK = 60;
  for (let i = 0; i < names.length; i += CHUNK) {
    const part = names.slice(i, i + CHUNK);
    const values = part.map((n) => `"${n.replace(/["\\]/g, '')}"@en`).join(' ');
    /* ★ 이름 라벨이 <b>꼭 같은</b> 사람만 봅니다. 그리고 직업이
         음악 쪽인지, 어떤 상을 받았는지 함께 받아 옵니다. */
    const q = `
      SELECT ?p ?pLabel (GROUP_CONCAT(DISTINCT ?occ; separator="|") AS ?occs)
             (GROUP_CONCAT(DISTINCT ?awLabel; separator="|") AS ?aws) WHERE {
        VALUES ?nm { ${values} }
        ?p rdfs:label ?nm .
        ?p wdt:P31 wd:Q5 .
        OPTIONAL { ?p wdt:P106 ?occ . }
        OPTIONAL { ?p wdt:P166 ?aw . ?aw rdfs:label ?awLabel . FILTER(LANG(?awLabel)="en") }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      GROUP BY ?p ?pLabel
      LIMIT 3000`;
    let got = [];
    try { got = await sparql(q); }
    catch (e) { console.log(`   ${i + 1}~${i + part.length}번째 묶음을 건너뜁니다 — ${e.message}`); }
    got.forEach((b) => {
      const qid = (b.p?.value || '').split('/').pop();
      const label = b.pLabel?.value || '';
      if (!qid || !label) return;
      const k = key(label);
      if (!byKey.has(k)) return;
      if (!found.has(k)) found.set(k, []);
      found.get(k).push({
        qid,
        label,
        jobs: (b.occs?.value || '').split('|').map((u) => u.split('/').pop()).filter(Boolean),
        awards: (b.aws?.value || '').toLowerCase(),
      });
    });
    console.log(`   ${Math.min(i + CHUNK, names.length)}/${names.length}개 물어봤습니다 — 지금까지 찾은 이름 ${found.size}개`);
    await sleep(1200);
  }

  /* ── ③ 짝 고르기 ──────────────────────────────────────── */
  /*  ★ 두 단계로 — 확실한 것부터
        1단계  그 콩쿠르 수상 기록이 위키데이터에도 있는 사람
        2단계  직업이 음악 쪽이고 후보가 하나뿐인 사람 */
  /* ★★ 소개문은 <b>한국어</b>인데(「2009년 퀸 엘리자베스 콩쿠르 1위」)
       위키데이터 수상 기록은 <b>영문</b>입니다(queen elisabeth
       competition). 그래서 <b>한국어 이름 ↔ 영문 낱말</b>을 짝지어
       둡니다. 이것이 없으면 1단계(가장 확실한 근거)가 늘 헛돕니다 —
       시험에서 잡았습니다. */
  const CONC = [
    ['쇼팽',        'chopin'],
    ['부조니',      'busoni'],
    ['리즈',        'leeds'],
    ['클라이번',    'cliburn'],
    ['차이콥스키',  'tchaikovsky'],
    ['퀸 엘리자베스', 'elisabeth'],
  ];
  const pick = [];
  const ambig = [];
  const none = [];

  for (const [k, people] of byKey) {
    const hits = found.get(k) || [];
    if (!hits.length) { people.forEach((p) => none.push(p)); continue; }

    for (const p of people) {
      /* 그 사람의 입상 이력에 나오는 대회를 봅니다 —
         소개문에 「2009년 퀸 엘리자베스 콩쿠르 1위」처럼 적어 두었습니다 */
      const intro = p.description || '';
      const mine = CONC.filter(([ko]) => intro.includes(ko));

      /* 1단계 — 위키데이터 수상 기록에 <b>그 대회</b>가 있는 사람 */
      const byAward = hits.filter((h) =>
        mine.some(([, en]) => h.awards.includes(en)));
      if (byAward.length === 1) {
        pick.push({ p, h: byAward[0], step: '1 · 수상 기록이 맞음' });
        continue;
      }
      if (byAward.length > 1) { ambig.push({ p, n: byAward.length, why: '수상 기록이 여럿' }); continue; }

      /* 2단계 — 직업이 음악 쪽이고 후보가 하나뿐 */
      const byJob = hits.filter((h) => h.jobs.some((j) => JOB.includes(j)));
      if (byJob.length === 1) { pick.push({ p, h: byJob[0], step: '2 · 음악가 한 명' }); continue; }
      if (byJob.length > 1) { ambig.push({ p, n: byJob.length, why: '음악가가 여럿' }); continue; }
      none.push(p);
    }
  }

  console.log('');
  console.log('── 고른 결과 ──');
  console.log(`   이을 수 있음 ${pick.length}명 · 후보 여럿 ${ambig.length}명 · 못 찾음 ${none.length}명`);

  if (pick.length) {
    console.log('');
    console.log('── 이을 짝 (앞 40명) ──');
    pick.slice(0, 40).forEach(({ p, h, step }) => {
      console.log(`   ${(p.name_en || '').padEnd(30)} → ${h.qid.padEnd(11)} ${h.label.padEnd(28)} [${step}]`);
    });
    if (pick.length > 40) console.log(`   … 그리고 ${pick.length - 40}명`);
  }
  if (ambig.length) {
    console.log('');
    console.log('── 후보가 여럿이라 두는 것 (앞 15명) ──');
    ambig.slice(0, 15).forEach(({ p, n, why }) =>
      console.log(`   ${(p.name_en || '').padEnd(30)} 후보 ${n}명 · ${why}`));
  }

  /* ── ④ 담기 ───────────────────────────────────────────── */
  if (DRY) {
    console.log('');
    console.log('※ 시험 실행이었습니다. 담으려면 --save 를 주십시오.');
    return;
  }
  let saved = 0;
  for (const { p, h } of pick) {
    try {
      await sb(`persons?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ wikidata_id: h.qid }),
      });
      saved++;
    } catch (e) {
      /* ★ 같은 번호를 다른 사람이 이미 가지고 있으면 막힙니다.
           그때는 <b>건드리지 않고 넘어갑니다</b> — 어느 쪽이 맞는지
           기계가 알 수 없습니다. */
      console.log(`   ${p.name_en} 을 잇지 못했습니다 — ${e.message.slice(0, 90)}`);
    }
    if (saved % 50 === 0 && saved) console.log(`   … ${saved}명 이었습니다`);
  }
  console.log('');
  console.log(`▶ 위키 번호를 붙인 사람 ${saved}명`);
  console.log('   이제 「인물DB 보강」 수집기가 사진·생몰년·나라를 채웁니다.');
}

main().catch((e) => { console.error('멈춤:', e.message); process.exit(1); });
