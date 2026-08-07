/* ============================================================
   OPUSCLAM 작품DB — 작품 형식 보강   seed/works-form.mjs
   2026-08-08

   무엇을 하나
    · 이미 담긴 작품의 위키데이터 번호로 <b>P31(이것은 무엇인가)</b>
      를 물어, 작품 형식을 채웁니다
        교향곡 · 오페라 · 협주곡 · 소나타 · 미사곡 · 가곡 …

   왜 별도 도구인가
    ★ 수집기(works-wikidata.mjs)를 고치면 <b>앞으로 담기는 것만</b>
      채워집니다. 이미 담긴 11,046개는 영원히 빈칸입니다.
      전체를 다시 훑는 것(--redo)은 너무 무겁습니다.
      그래서 <b>형식만 채우는</b> 도구를 따로 둡니다.
      works-openopus.mjs 와 같은 자리의 보강 도구입니다.

   ★ 형식과 편성을 섞지 않습니다
    P31 은 <b>형식</b>(교향곡 · 소나타)이고 genre 는 <b>편성</b>
    (관현악 · 건반)입니다. 형식을 편성으로 바꾸려면 추론이 들어갑니다.

        symphony → 관현악   ○ 의심 없습니다
        sonata   → 건반     ✗ 바이올린 소나타가 건반이 됩니다

    그래서 <b>형식은 형식 칸에</b> 담고, 편성은 의심 없는 것만
    채웁니다. 애매한 것은 <b>비워 둡니다.</b> 2026-08-07 학술DB 에서
    자동 판정으로 세 번 오판한 것이 이 지점입니다.

   ★ 처음에는 --dry 로 <b>무엇이 오는지</b> 보십시오
    번역표(FORM_KO)를 미리 다 채울 수 없습니다. 어떤 형식이 올지
    모르는데 채우면 지어내는 것이 됩니다. --dry 는 <b>받은 형식의
    분포</b>와 <b>번역표에 없는 것</b>을 보여 줍니다. 그것을 보고
    번역표를 채운 뒤 실제로 담습니다.

   쓰는 법
     node seed/works-form.mjs --dry            무엇이 오는지만 봅니다
     node seed/works-form.mjs --dry --limit=500
     node seed/works-form.mjs                  실제로 담습니다

   옵션
     --dry          담지 않습니다 (분포만 보여 줍니다)
     --limit=N      작품 몇 개까지 (기본 3000)
     --batch=N      한 번에 물어볼 작품 수 (기본 150)
     --redo         형식이 이미 있는 작품도 다시 물어봅니다
     --all          편성이 채워진 작품도 대상에 넣습니다
                    (기본은 편성이 빈 것부터 — 급한 쪽입니다)
     --debug        받은 값을 자세히

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
const DRY   = !!args.dry;
const DEBUG = !!args.debug;
const REDO  = !!args.redo;
const ALL   = !!args.all;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 3000;
const BATCH = Number(args.batch) > 0 ? Number(args.batch) : 150;

const WDQS = 'https://query.wikidata.org/sparql';
const UA   = 'OpusclamFormBot/1.0 (https://opusclam.com)';

/* ============================================================
   번역표 — 형식 이름을 한국어로

   ★ 이것은 <b>번역</b>입니다. 추론이 아닙니다.
     symphony 가 교향곡인 것은 정해진 사실입니다.
   ★ 여기에 없는 형식은 <b>영문 그대로 남깁니다.</b> 지어내지
     않습니다. --dry 가 「번역표에 없는 것」 을 보여 주므로 그것을
     보고 채워 갑니다.
   ★ 열쇠는 위키데이터 번호(QID)입니다. 라벨은 바뀔 수 있지만
     번호는 바뀌지 않습니다. 다만 지금은 번호를 확인할 수 없으므로
     <b>영문 라벨을 소문자로 낮춘 것</b>을 열쇠로 씁니다.
     (QID 를 제 기억으로 적으면 지어내는 것이 됩니다)
   ============================================================ */
const FORM_KO = {
  /* 아래는 클래식에서 뜻이 하나로 정해진 것들입니다.
     --dry 결과를 보고 이어서 채웁니다. */
  'symphony'              : '교향곡',
  'opera'                 : '오페라',
  'operetta'              : '오페레타',
  'concerto'              : '협주곡',
  'sonata'                : '소나타',
  'string quartet'        : '현악사중주',
  'mass'                  : '미사곡',
  'requiem'               : '레퀴엠',
  'oratorio'              : '오라토리오',
  'cantata'               : '칸타타',
  'motet'                 : '모테트',
  'ballet'                : '발레',
  'overture'              : '서곡',
  'suite'                 : '조곡',
  'symphonic poem'        : '교향시',
  'song'                  : '가곡',
  'lied'                  : '리트',
  'aria'                  : '아리아',
  'prelude'               : '전주곡',
  'fugue'                 : '푸가',
  'etude'                 : '연습곡',
  'nocturne'              : '야상곡',
  'waltz'                 : '왈츠',
  'mazurka'               : '마주르카',
  'polonaise'             : '폴로네즈',
  'march'                 : '행진곡',
  'serenade'              : '세레나데',
  'divertimento'          : '디베르티멘토',
  'rhapsody'              : '랩소디',
  'variation'             : '변주곡',
  'fantasia'              : '환상곡',
  'toccata'               : '토카타',
  'chorale'               : '코랄',
  'hymn'                  : '찬가',
  'psalm'                 : '시편',
  'musical composition'   : '',   /* ★ 너무 넓어 쓸모없습니다 — 비웁니다 */
  'composition'           : '',
  'musical work'          : '',
  'musical work/composition': '',
};

/* ============================================================
   편성 채우기 — <b>의심 없는 것만</b>

   ★ 여기에 없는 형식은 편성을 <b>건드리지 않습니다.</b>
     sonata · etude · prelude · fantasia 는 악기를 모르면
     정할 수 없습니다. 비워 두는 것이 틀리게 넣는 것보다 낫습니다.
   ★ 값은 db/work-view.html 의 GKO 와 같아야 합니다.
     (Orchestral 관현악 · Keyboard 건반 · Chamber 실내악 ·
      Stage 무대 · 오페라 · Vocal 성악)
     ★ 표에 담는 값은 <b>영문</b>입니다 — 기존 Open Opus 값과
       같은 모양이어야 필터(oc_work_facets)가 어긋나지 않습니다.
   ============================================================ */
const FORM_GENRE = {
  'symphony'       : 'Orchestral',
  'symphonic poem' : 'Orchestral',
  'overture'       : 'Orchestral',
  'concerto'       : 'Orchestral',
  'opera'          : 'Stage',
  'operetta'       : 'Stage',
  'ballet'         : 'Stage',
  'string quartet' : 'Chamber',
  'mass'           : 'Vocal',
  'requiem'        : 'Vocal',
  'oratorio'       : 'Vocal',
  'cantata'        : 'Vocal',
  'motet'          : 'Vocal',
  'aria'           : 'Vocal',
  'lied'           : 'Vocal',
  'psalm'          : 'Vocal',
};

/* ★ 형식이 여러 개 올 때 어느 것을 고르나
     한 작품에 P31 이 둘 이상 붙는 일이 잦습니다
     (오페라이면서 무대작품, 교향곡이면서 음악작품).
     구체적인 것을 골라야 합니다. 아래에 가까울수록 넓은 말이라
     <b>뒤로 밀립니다.</b> */
const TOO_BROAD = new Set([
  'musical composition', 'composition', 'musical work',
  'musical work/composition', 'work', 'artistic work',
  'creative work', 'written work',
]);

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

/* 위키데이터는 붐빌 때 429 · 500 을 돌려줍니다. 네 번까지 다시 묻습니다. */
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

/* ============================================================
   1) 대상 모으기

   ★ PostgREST 는 한 번에 <b>200개까지만</b> 줍니다. limit=3000 을
     줘도 200개만 옵니다. 그래서 나눠 받습니다.
   ★ 끝냄은 <b>0개일 때만</b> 판단합니다. 「받은 수 < 요청한 수」로
     하면 200개를 받은 첫 바퀴에서 멈춥니다
     (2026-08-07 에 이 실수를 두 번 했습니다).
   ★ offset 은 <b>실제로 받은 수만큼</b> 넘깁니다.
   ★ order 에 id 를 넣습니다 — 정렬이 흔들리면 빠지거나 겹칩니다.
   ============================================================ */
async function pickTargets() {
  const PAGE = 200;
  const out = [];
  let off = 0;

  let q = 'person_works?select=id,wikidata_id,title,genre,form_raw'
        + '&wikidata_id=not.is.null'
        + '&order=id.asc';
  if (!REDO) q += '&form_raw=is.null';   /* 이미 형식이 있는 것은 넘깁니다 */
  if (!ALL)  q += '&genre=is.null';      /* 편성이 빈 것부터 — 급한 쪽 */

  while (out.length < LIMIT) {
    const want = Math.min(PAGE, LIMIT - out.length);
    const rows = await sb(`${q}&limit=${want}&offset=${off}`);
    if (!rows || !rows.length) break;    /* 0개일 때만 끝냅니다 */
    out.push(...rows);
    off += rows.length;                  /* 실제로 받은 수만큼 */
  }
  return out;
}

/* ============================================================
   2) 형식 물어보기

   ★ 라벨을 SERVICE 없이 직접 받습니다 — 어떤 말이 올지 정하려면
     영어를 명시해야 합니다(works-wikidata.mjs 와 같은 판단).
   ★ OPTIONAL 로 둡니다 — 영어 라벨이 없는 형식도 번호는 받아
     두어야 나중에 채울 수 있습니다.
   ============================================================ */
async function fetchForms(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const query = `
SELECT ?work ?form ?lbl WHERE {
  VALUES ?work { ${values} }
  ?work wdt:P31 ?form .
  OPTIONAL { ?form rdfs:label ?lbl . FILTER(lang(?lbl) = "en") }
}
LIMIT ${qids.length * 12}`;

  const rows = await sparql(query);
  if (rows === null) return null;

  /* 작품마다 형식 여러 개를 모읍니다 */
  const byWork = new Map();
  for (const b of rows) {
    const wQid = String(b.work.value).split('/').pop();
    const fQid = String(b.form.value).split('/').pop();
    const lbl  = (b.lbl && b.lbl.value) ? String(b.lbl.value).trim() : '';
    const arr  = byWork.get(wQid) || [];
    if (!arr.some((x) => x.qid === fQid)) arr.push({ qid: fQid, label: lbl });
    byWork.set(wQid, arr);
  }
  return byWork;
}

/* ★ 여러 형식 가운데 <b>가장 구체적인 것</b>을 고릅니다.
     넓은 말(musical composition)은 뒤로 밀고, 번역표에 있는 것을
     먼저 고릅니다 — 우리가 아는 말이 곧 구체적인 말입니다. */
function pickForm(forms) {
  if (!forms || !forms.length) return null;
  const norm = (s) => String(s || '').trim().toLowerCase();

  const narrow = forms.filter((f) => !TOO_BROAD.has(norm(f.label)));
  const pool   = narrow.length ? narrow : forms;

  /* 번역표에 있고 빈 값이 아닌 것 우선 */
  const known = pool.find((f) => FORM_KO[norm(f.label)]);
  if (known) return known;

  /* 그다음은 라벨이 있는 것 */
  const labeled = pool.find((f) => f.label);
  return labeled || pool[0];
}

/* ============================================================
   3) 담기

   ★ 200개씩 나눠 보냅니다. 묶음이 크면 하나가 실패할 때 전부
     되돌려집니다.
   ★ 형식이 이미 같으면 보내지 않습니다 — 쓸데없는 수정은
     updated_at 만 흔듭니다.
   ============================================================ */
async function saveRows(rows) {
  let ok = 0;
  const fail = [];
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    try {
      /* ★ id 를 열쇠로 하는 upsert 입니다. 다른 칸은 건드리지
         않습니다 — 보내지 않은 칸은 그대로 남습니다. */
      await sb('person_works?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(part),
      });
      ok += part.length;
    } catch (e) {
      /* 묶음이 실패하면 한 건씩 다시 담습니다 */
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 건씩 다시 담습니다`);
      for (const r of part) {
        try {
          await sb('person_works?on_conflict=id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([r]),
          });
          ok += 1;
        } catch (e2) {
          fail.push({ id: r.id, why: e2.message });
        }
      }
    }
  }
  return { ok, fail };
}

/* ============================================================
   4) 본줄기
   ============================================================ */
async function main() {
  console.log('══ 작품DB 형식 보강 ══');
  console.log(DRY ? '※ 담지 않습니다 — 무엇이 오는지만 봅니다'
                  : '※ 실제로 담습니다');
  console.log(`   작품 최대 ${LIMIT}개 · 한 묶음 ${BATCH}개`);
  if (REDO) console.log('   형식이 이미 있는 작품도 다시 물어봅니다');
  if (ALL)  console.log('   편성이 채워진 작품도 대상입니다');
  console.log('');

  const targets = await pickTargets();
  if (!targets.length) {
    console.log('대상이 없습니다. 형식이 이미 채워졌거나 위키데이터 번호가 없습니다.');
    return;
  }
  console.log(`대상 작품 ${targets.length}개`);
  console.log('');

  const byQid = new Map();
  for (const t of targets) {
    const k = String(t.wikidata_id).trim();
    if (!byQid.has(k)) byQid.set(k, []);
    byQid.get(k).push(t);
  }
  const qids = [...byQid.keys()];

  /* 셈 */
  const formCount   = new Map();   /* 영문 라벨 → 몇 개 */
  const noTrans     = new Map();   /* 번역표에 없는 것 */
  const rows        = [];          /* 담을 것 */
  let gotForm = 0, noForm = 0, noLabel = 0, genreFilled = 0;

  for (let i = 0; i < qids.length; i += BATCH) {
    const part = qids.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(qids.length / BATCH);
    console.log(`── 묶음 ${n}/${total} : 작품 ${part.length}개`);

    const got = await fetchForms(part);
    if (got === null) { await sleep(3000); continue; }

    for (const qid of part) {
      const forms = got.get(qid);
      const works = byQid.get(qid) || [];
      if (!forms || !forms.length) { noForm += works.length; continue; }

      const picked = pickForm(forms);
      if (!picked) { noForm += works.length; continue; }

      const key = String(picked.label || '').trim().toLowerCase();
      if (!key) { noLabel += works.length; continue; }

      formCount.set(key, (formCount.get(key) || 0) + works.length);

      /* 번역표에 있으면 한국어, 없으면 <b>영문 그대로</b>.
         지어내지 않습니다. */
      const hasKo = Object.prototype.hasOwnProperty.call(FORM_KO, key);
      if (!hasKo) noTrans.set(key, (noTrans.get(key) || 0) + works.length);

      /* FORM_KO 에 빈 문자열로 적힌 것은 「너무 넓어 쓸모없음」 입니다.
         그런 것은 담지 않습니다. */
      const ko = hasKo ? FORM_KO[key] : picked.label;
      if (!ko) { noLabel += works.length; continue; }

      const genre = FORM_GENRE[key] || null;

      for (const w of works) {
        gotForm += 1;
        const row = {
          id       : w.id,
          form_raw : picked.label,
          form_ko  : ko,
          form_qid : picked.qid,
        };
        /* ★ 편성은 <b>비어 있을 때만</b>, 그리고 의심 없는 것만
           채웁니다. 이미 값이 있으면 건드리지 않습니다 —
           Open Opus 가 넣은 값이 더 정확할 수 있습니다. */
        if (genre && !String(w.genre || '').trim()) {
          row.genre = genre;
          genreFilled += 1;
        }
        rows.push(row);
      }

      if (DEBUG) {
        console.log(`   ${qid} → ${picked.label} (${picked.qid})`
                  + `${genre ? ' · 편성 ' + genre : ''}`
                  + `  [형식 ${forms.length}개 중]`);
      }
    }
    await sleep(1200);
  }

  console.log('');
  console.log('══ 받은 형식 분포 ══');
  const sorted = [...formCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted.slice(0, 40)) {
    const ko = Object.prototype.hasOwnProperty.call(FORM_KO, k)
      ? (FORM_KO[k] || '(비움)') : '★ 번역표에 없음';
    console.log(`  ${String(v).padStart(6)}  ${k}  →  ${ko}`);
  }
  if (sorted.length > 40) console.log(`  … 그 밖 ${sorted.length - 40}가지`);

  if (noTrans.size) {
    console.log('');
    console.log('★ 번역표에 없는 형식 — 이것을 알려 주십시오');
    const nt = [...noTrans.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of nt.slice(0, 40)) {
      console.log(`  ${String(v).padStart(6)}  ${k}`);
    }
    if (nt.length > 40) console.log(`  … 그 밖 ${nt.length - 40}가지`);
    console.log('  (지금은 영문 그대로 담깁니다 — 지어내지 않습니다)');
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  대상 작품            ${targets.length}개`);
  console.log(`  형식을 얻은 것       ${gotForm}개`);
  console.log(`  형식이 없는 것       ${noForm}개`);
  console.log(`  이름이 없어 건너뜀   ${noLabel}개`);
  console.log(`  편성도 함께 채울 것  ${genreFilled}개`);
  console.log(`  형식 가지수          ${formCount.size}가지`);

  if (DRY) {
    console.log('');
    console.log('※ --dry 이므로 담지 않았습니다.');
    console.log('  위 「번역표에 없는 형식」 을 알려 주시면 번역표를 채워 드립니다.');
    return;
  }

  if (!rows.length) {
    console.log('');
    console.log('담을 것이 없습니다.');
    return;
  }

  console.log('');
  console.log(`── 담습니다 : ${rows.length}개 ──`);
  const { ok, fail } = await saveRows(rows);
  console.log(`  담김 ${ok}개${fail.length ? ` · 실패 ${fail.length}개` : ''}`);
  if (fail.length) {
    console.log('  ★ 담지 못한 것:');
    for (const f of fail.slice(0, 15)) console.log(`    · id ${f.id} — ${f.why}`);
    if (fail.length > 15) console.log(`    … 그 밖 ${fail.length - 15}개`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
