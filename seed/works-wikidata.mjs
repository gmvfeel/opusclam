/* ============================================================
   OPUSCLAM 작품DB — 위키데이터 수집  seed/works-wikidata.mjs

   무엇을 하나
    · 인물DB 의 작곡가마다 위키데이터에서 <b>작품 목록</b>을 받아
      person_works 표에 담습니다

   왜 위키데이터부터인가
    인물DB 9,332명 가운데 <b>9,321명이 위키데이터 번호를 가지고</b>
    있습니다(99.9%). 그래서 작품을 위키데이터에서 받으면
    「이 작품은 누구 것인가」가 <b>문자열 짐작 없이</b> 정해집니다.
    이름으로 맞추면 J.S. Bach 와 Johann Sebastian Bach 가 어긋납니다.

    게다가 위키데이터는 <b>P839(IMSLP 문서 이름)</b>을 줍니다. 그 값이
    우리 악보 표(score_links.imslp_ref)와 <b>같은 모양</b>입니다.

      Symphony_No.8,_Op.88_(Dvořák,_Antonín)

    그러니 작품 ↔ 악보가 문자열 매칭 없이 그대로 이어집니다.

   ★ 2026-08-07 <b>제목 언어를 고쳤습니다</b>
    첫판은 영어 라벨만 봤습니다. 그래서 첫 시험에서
    <b>621개를 「이름 없음」으로 버렸습니다.</b> 그런데 클래식은
    <b>원어가 정본</b>입니다.
        Die Zauberflöte · Le nozze di Figaro · L'elisir d'amore
    이제 en → de → it → fr → la → es → ru → ko 순으로 고릅니다.
    (마술피리도 영어 라벨이 있어 살아남은 것입니다. 없었으면 버려졌습니다)

   ★ 지어내지 않습니다
    제목 · 작곡연도 · IMSLP 번호는 모두 위키데이터에서 받습니다.
    영어 이름조차 없는 항목은 <b>담지 않습니다</b> — 이름만 있는 껍데기가
    쌓이면 「개수보다 충실도」 원칙을 해칩니다.

   ★ 중복이 쌓이지 않습니다
    source_id 에 wd:Q188709 처럼 담고 그 칸이 <b>고유</b>로 묶여
    있습니다. 여러 번 돌려도 같은 작품이 두 번 들어가지 않습니다.

   쓰는 법
     node seed/works-wikidata.mjs --dry              담지 않고 보기
     node seed/works-wikidata.mjs --dry --limit=5    작곡가 5명만 보기
     node seed/works-wikidata.mjs                    실제로 담기
     node seed/works-wikidata.mjs --composer=Q1339   바흐만
     node seed/works-wikidata.mjs --debug            자세히

   옵션
     --dry              담지 않습니다 (무엇이 들어올지만 보여 줍니다)
     --limit=N          작곡가 몇 명까지 (기본 20)
     --batch=N          한 번에 물어볼 작곡가 수 (기본 3)
     --min-scores=N     악보가 N개 이상인 작곡가만 (기본 1)
     --composer=Q1339   그 작곡가만 (여러 개는 쉼표로)
     --max-works=N      한 작곡가당 최대 작품 수 (기본 800)
     --debug            받은 값을 자세히

   ★ 대상을 고르는 순서
     악보가 많이 담긴 작곡가부터입니다(persons.score_count 내림차순).
     그분들은 IMSLP 연결이 바로 확인되고, 널리 연주되는 작곡가이므로
     작품 정보도 충실합니다. 6,860명을 한 번에 돌리지 않습니다.

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
const DRY        = !!args.dry;
const DEBUG      = !!args.debug;
const LIMIT      = Number(args.limit) > 0 ? Number(args.limit) : 20;
const BATCH      = Number(args.batch) > 0 ? Number(args.batch) : 3;
const MIN_SCORES = args['min-scores'] !== undefined ? Number(args['min-scores']) : 1;
const MAX_WORKS  = Number(args['max-works']) > 0 ? Number(args['max-works']) : 800;
const ONLY_QIDS  = typeof args.composer === 'string'
  ? args.composer.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const WDQS = 'https://query.wikidata.org/sparql';
const UA   = 'OpusclamWorksBot/1.0 (https://opusclam.com)';

/* ============================================================
   도구
   ============================================================ */
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* 위키데이터는 붐빌 때 429 · 500 을 돌려줍니다. 네 번까지 기다렸다 다시 묻습니다. */
async function sparql(query) {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(query)}`;
  for (let t = 1; t <= 4; t++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
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

/* Q12345 같은 라벨은 「이름이 없다」는 뜻입니다 */
function isEmptyLabel(s, qid) {
  if (!s) return true;
  const v = String(s).trim();
  if (!v) return true;
  if (v === qid) return true;
  if (/^Q\d+$/.test(v)) return true;
  return false;
}

/* ★ 제목을 어느 말에서 고를까 — <b>클래식은 원어가 정본입니다</b>
   첫판은 영어 라벨만 봤습니다. 그래서
       Die Zauberflöte · Le nozze di Figaro · L'elisir d'amore
   처럼 <b>원어 제목만 있는 작품 621개를 버렸습니다.</b>
   영어가 없으면 독일어 · 이탈리아어 · 프랑스어 · 라틴어를 씁니다.
   그것마저 없으면 한국어라도 씁니다. */
const TITLE_LANGS = ['en', 'de', 'it', 'fr', 'la', 'es', 'ru', 'ko'];

function pickTitle(labels, qid) {
  for (const lg of TITLE_LANGS) {
    const v = labels[lg];
    if (!isEmptyLabel(v, qid)) return { title: v, lang: lg };
  }
  return null;
}

/* 1685-01-01T00:00:00Z → 1685 */
function yearOf(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(-?\d{1,4})-/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   1) 대상 작곡가 고르기
   ============================================================ */
async function pickComposers() {
  if (ONLY_QIDS) {
    const inList = ONLY_QIDS.map((q) => `"${q}"`).join(',');
    const rows = await sb(
      `persons?select=id,name_ko,name_en,wikidata_id,era_name,score_count` +
      `&wikidata_id=in.(${inList})`
    );
    return rows || [];
  }

  /* 악보가 많은 작곡가부터. score_count 가 빈 값인 분은 뒤로 갑니다. */
  const rows = await sb(
    `persons?select=id,name_ko,name_en,wikidata_id,era_name,score_count` +
    `&field=like.*작곡*` +
    `&wikidata_id=not.is.null` +
    `&score_count=gte.${MIN_SCORES}` +
    `&order=score_count.desc.nullslast,id.asc` +
    `&limit=${LIMIT}`
  );
  return rows || [];
}

/* ============================================================
   2) 위키데이터에서 작품 받기

   ★ 왜 작곡가를 조금씩 묶어 묻나
     바흐 한 사람만 해도 작품이 1,000개를 넘습니다. 한꺼번에 물으면
     위키데이터가 시간을 넘겨 아무것도 돌려주지 않습니다.
     조금씩 물으면 한 묶음이 실패해도 나머지는 담깁니다.

   ★ 라벨을 SERVICE 없이 직접 가져옵니다
     wikibase:label 서비스는 어떤 언어가 올지 예측하기 어렵습니다.
     영어와 한국어를 <b>따로 명시</b>해 받아야 무엇이 비었는지 압니다.
   ============================================================ */
async function fetchWorks(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const langs = TITLE_LANGS.map((l) => `"${l}"`).join(', ');

  /* ★ 말마다 OPTIONAL 을 따로 두지 않습니다 — 여덟 개를 늘어놓으면
     위키데이터가 무거워집니다. 한 번에 받아 아래에서 갈라 담습니다.
     한 작품이 말 수만큼 여러 줄로 오지만 작품 번호로 다시 모읍니다. */
  const query = `
SELECT ?composer ?work ?lbl ?imslp ?inception WHERE {
  VALUES ?composer { ${values} }
  ?work wdt:P86 ?composer .
  OPTIONAL { ?work rdfs:label ?lbl . FILTER(lang(?lbl) IN (${langs})) }
  OPTIONAL { ?work wdt:P839 ?imslp . }
  OPTIONAL { ?work wdt:P571 ?inception . }
}
LIMIT ${MAX_WORKS * qids.length * (TITLE_LANGS.length + 2)}`;

  const rows = await sparql(query);
  if (rows === null) return null;

  /* 작품 번호를 열쇠로 하나로 모읍니다.
     라벨은 말별로 labels 에 담습니다. */
  const byWork = new Map();
  for (const b of rows) {
    const cQid = String(b.composer.value).split('/').pop();
    const wQid = String(b.work.value).split('/').pop();
    const key = `${cQid}|${wQid}`;
    const cur = byWork.get(key) || {
      composerQid: cQid, workQid: wQid,
      labels: {}, imslp: null, inception: null,
    };
    if (b.lbl && b.lbl.value) {
      const lg = b.lbl['xml:lang'] || '';
      if (lg && !cur.labels[lg]) cur.labels[lg] = b.lbl.value;
    }
    if (b.imslp && !cur.imslp) cur.imslp = b.imslp.value;
    if (b.inception && !cur.inception) cur.inception = b.inception.value;
    byWork.set(key, cur);
  }
  return [...byWork.values()];
}

/* ============================================================
   3) 이미 담긴 것 알아보기

   ★ source_id 로 봅니다. 여러 번 돌려도 같은 작품이 두 번
     들어가지 않습니다.
   ============================================================ */
async function loadExisting(sourceIds) {
  const have = new Set();
  const CH = 150;
  for (let i = 0; i < sourceIds.length; i += CH) {
    const part = sourceIds.slice(i, i + CH);
    const inList = part.map((s) => `"${s}"`).join(',');
    const rows = await sb(
      `person_works?select=source_id&source_id=in.(${inList})`
    );
    for (const r of (rows || [])) have.add(r.source_id);
  }
  return have;
}

/* ============================================================
   4) 담기 — 묶음으로 넣고, 실패하면 한 건씩 다시
   ============================================================ */
async function saveRows(rows) {
  let saved = 0;
  const failed = [];
  const CH = 200;

  for (let i = 0; i < rows.length; i += CH) {
    const part = rows.slice(i, i + CH);
    try {
      await sb('person_works', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(part),
      });
      saved += part.length;
    } catch (e) {
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 건씩 다시 담습니다`);
      for (const one of part) {
        try {
          await sb('person_works', {
            method: 'POST', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([one]),
          });
          saved++;
        } catch (e2) {
          const why = String(e2.message || '');
          let short = why;
          const m = why.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/);
          if (m) short = `${m[1]} 값이 이미 있습니다`;
          else if (/violates not-null/.test(why)) short = '비울 수 없는 칸이 비었습니다';
          else if (/column .* does not exist/.test(why)) {
            const c = why.match(/column "?([a-z_]+)"? does not exist/);
            short = `person_works 에 「${c ? c[1] : '?'}」 칸이 없습니다`;
          }
          failed.push({ title: one.title, why: short });
        }
      }
    }
  }
  return { saved, failed };
}

/* ============================================================
   본줄기
   ============================================================ */
async function main() {
  console.log('══ 작품DB 위키데이터 수집 ══');
  console.log(DRY ? '※ 담지 않습니다 (--dry)' : '※ 실제로 담습니다');
  console.log(`   작곡가 최대 ${LIMIT}명 · 한 묶음 ${BATCH}명 · 악보 ${MIN_SCORES}개 이상`);
  console.log('');

  const composers = await pickComposers();
  if (!composers.length) {
    console.log('대상 작곡가가 없습니다.');
    if (!ONLY_QIDS) {
      console.log('  · --min-scores 를 0 으로 낮춰 보십시오');
      console.log('    (악보가 담긴 작곡가가 아직 없을 수 있습니다)');
    }
    return;
  }

  console.log(`대상 작곡가 ${composers.length}명`);
  for (const c of composers) {
    console.log(`  · ${c.name_ko || c.name_en || '(이름 없음)'}` +
                ` [${c.wikidata_id}] 악보 ${c.score_count == null ? '?' : c.score_count}개`);
  }
  console.log('');

  const byQid = new Map(composers.map((c) => [c.wikidata_id, c]));
  let gotTotal = 0, skipNoName = 0, skipHave = 0, newTotal = 0;
  let savedTotal = 0;
  const allFailed = [];
  const withImslp = [];

  for (let i = 0; i < composers.length; i += BATCH) {
    const part = composers.slice(i, i + BATCH);
    const names = part.map((c) => c.name_ko || c.name_en).join(' · ');
    console.log(`── 묶음 ${Math.floor(i / BATCH) + 1} : ${names}`);

    const works = await fetchWorks(part.map((c) => c.wikidata_id));
    if (works === null) continue;
    gotTotal += works.length;
    console.log(`   받은 작품 ${works.length}개`);

    /* 충실도 컷오프 — <b>어느 말로도</b> 이름이 없는 항목만 버립니다.
       영어가 없어도 원어(독일어 · 이탈리아어 …)가 있으면 담습니다. */
    const usable = [];
    const skipped = [];
    for (const w of works) {
      const picked = pickTitle(w.labels, w.workQid);
      if (!picked) { skipNoName++; skipped.push(w.workQid); continue; }
      w.picked = picked;
      usable.push(w);
    }
    if (skipped.length) {
      console.log(`   이름이 없어 건너뜀 ${skipped.length}개` +
        (DEBUG ? ` : ${skipped.slice(0, 10).join(' ')}` +
                 (skipped.length > 10 ? ` … 그 밖 ${skipped.length - 10}개` : '')
               : ''));
    }

    /* 어느 말에서 제목을 골랐는지 — 원어 비율을 보여 줍니다 */
    if (usable.length) {
      const byLang = {};
      for (const w of usable) byLang[w.picked.lang] = (byLang[w.picked.lang] || 0) + 1;
      const parts = Object.keys(byLang).sort((a, b) => byLang[b] - byLang[a])
        .map((k) => `${k} ${byLang[k]}`);
      console.log(`   제목을 고른 말 : ${parts.join(' · ')}`);
    }

    if (!usable.length) { console.log('   담을 것이 없습니다'); continue; }

    const ids = usable.map((w) => `wd:${w.workQid}`);
    const have = await loadExisting(ids);

    const rows = [];
    for (const w of usable) {
      const sid = `wd:${w.workQid}`;
      if (have.has(sid)) { skipHave++; continue; }
      const c = byQid.get(w.composerQid);
      if (!c) continue;
      const yr = yearOf(w.inception);
      const imslpRef = w.imslp ? String(w.imslp).replace(/\s/g, '_') : null;
      if (imslpRef) withImslp.push(imslpRef);
      const koLabel = w.labels.ko;
      rows.push({
        person_id:   c.id,
        title:       w.picked.title,
        title_ko:    (w.picked.lang !== 'ko' && !isEmptyLabel(koLabel, w.workQid))
                       ? koLabel : null,
        wikidata_id: w.workQid,
        imslp_ref:   imslpRef,
        year_from:   yr,
        year_text:   yr ? String(yr) : null,
        era:         c.era_name || null,
        source:      'wikidata',
        source_id:   sid,
      });
    }
    newTotal += rows.length;
    console.log(`   새로 담을 것 ${rows.length}개 (이미 있음 ${have.size}개)`);

    if (DEBUG) {
      for (const r of rows.slice(0, 12)) {
        console.log(`     · ${r.title}` +
                    (r.title_ko ? ` / ${r.title_ko}` : '') +
                    (r.imslp_ref ? ` [IMSLP ${r.imslp_ref}]` : '') +
                    (r.year_from ? ` (${r.year_from})` : ''));
      }
      if (rows.length > 12) console.log(`     … 그 밖 ${rows.length - 12}개`);
    }

    if (!DRY && rows.length) {
      const { saved, failed } = await saveRows(rows);
      savedTotal += saved;
      allFailed.push(...failed);
      console.log(`   담김 ${saved}개` + (failed.length ? ` · 실패 ${failed.length}개` : ''));
    }

    await sleep(1200);   /* 위키데이터를 몰아치지 않습니다 */
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  받은 작품          ${gotTotal}개`);
  console.log(`  이름이 없어 건너뜀 ${skipNoName}개`);
  console.log(`  이미 담겨 있어 건너뜀 ${skipHave}개`);
  console.log(`  새로 담을 것       ${newTotal}개`);
  if (!DRY) console.log(`  실제로 담김        ${savedTotal}개`);
  console.log(`  IMSLP 번호가 있는 것 ${withImslp.length}개  ← 악보와 이을 수 있습니다`);

  if (withImslp.length) {
    console.log('  IMSLP 표본:');
    for (const s of withImslp.slice(0, 5)) console.log(`    · ${s}`);
  }

  if (allFailed.length) {
    console.log('');
    console.log(`  ★ 담지 못한 것 ${allFailed.length}개`);
    for (const f of allFailed.slice(0, 15)) {
      console.log(`    · ${f.title} — ${f.why}`);
    }
    if (allFailed.length > 15) console.log(`    … 그 밖 ${allFailed.length - 15}개`);
  }

  if (DRY) {
    console.log('');
    console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
    console.log('  목록이 알맞으면 --dry 를 떼고 다시 돌리십시오.');
  }
}

main().catch((e) => {
  console.error('멈췄습니다:', e.message);
  process.exit(1);
});
