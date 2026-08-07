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
   ★ 2026-08-08 확인 실행으로 알아낸 것 — 전제가 무너졌습니다
    「클래식 작품에는 P31 이 잘 채워져 있다」고 보았는데,
    2,000개를 물어보니 <b>1,375개(69%)가 musical work/composition</b>
    — 그냥 「음악 작품」 이라는 가장 넓은 말뿐이었습니다.
    구체적 형식을 얻은 것은 623개(31%)입니다.

    ★ 그런데 더 중요한 것이 드러났습니다
      형식을 얻은 623개 가운데 <b>개별 음악 작품이 아닌 것이 72%</b>
      였습니다. 영화 228개 · 판본 93개 · 묶음 항목 85개 ·
      음반과 필사본 37개. 그래서 이 도구의 값은 <b>형식 채우기보다
      무엇이 작품이 아닌지 알아내는 것</b>에 있습니다.

    ★ 영화가 왜 들어왔나
      위키데이터에서 영화의 P86 은 <b>영화음악 작곡가</b>를
      가리킵니다. 수집기가 P86 으로 작품을 찾으니 영화 자체가
      「그 작곡가의 작품」 으로 들어왔습니다.
      ★ 지우지 않습니다 — 편성을 「영화·방송」 으로 주어 살립니다.
        존 윌리엄스 작품 목록에 「스타워즈」 가 있는 것이 맞습니다.

   ★ 번역표(FORM)에 없는 형식은 <b>영문 그대로</b> 담고 편성은
    건드리지 않습니다. 지어내지 않습니다. --dry 가 「번역표에 없는
    형식」 을 보여 주므로 그것을 보고 채워 갑니다.

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
   형식표는 이제 <b>DB 표</b>에 있습니다 — oc_work_forms

   ★ 2026-08-08 이 파일 안에 있던 목록 161가지를 DB 로 옮겼습니다.

   ── 왜 옮겼나 ────────────────────────────────────────────
   같은 표가 <b>두 곳</b>에 있었습니다.

       이 파일의 FORM 상수          담을 때 쓰는 표
       oc_work_form_kind() 함수     갈래를 셀 때 쓰는 표

   형식은 앞으로도 계속 새로 나옵니다. 오늘 하루에만 두 번 늘렸고
   (102가지 → 161가지), 그때마다 <b>두 파일을 고쳐 배포</b>해야
   했습니다. 어긋나면 담긴 것과 세는 것이 달라집니다.

   ★ 이제 사본이 하나입니다. 형식을 늘릴 때는 <b>DB 표에 한 줄</b>
     넣으면 끝이고 이 파일을 고칠 일이 없습니다.

   ── 앞으로 형식을 늘리는 법 ──────────────────────────────
       insert into oc_work_forms (form_raw, form_ko, genre, kind, note)
       values ('nocturne', '야상곡', null, 'work', null);

     그다음 <b>위키데이터에 다시 묻지 않고</b> 이렇게 입힙니다.
       select * from oc_work_apply_forms(true);   -- 무엇이 바뀔지 먼저
       select * from oc_work_apply_forms(false);  -- 실제로 입히기

   ── 갈래가 뜻하는 것 ─────────────────────────────────────
     work   음악 작품 — 그대로 살립니다
     video  영상물 — 편성을 「영화·방송」 으로 주어 살립니다.
            영화의 P86 은 <b>영화음악 작곡가</b>를 가리킵니다
     part   작품의 일부 — 악장 · 장면 · 막. 「발퀴레의 기행」 이 이것
     group  묶음 항목 — 「니벨룽의 반지」 4부작 같은 것
     aside  작품이 아님 — 판본 · 음반 · 필사본 · 특정 공연
     broad  너무 넓음 — form_ko 가 빈 글자입니다. 화면에 안 보이되
            form_raw 는 담습니다(다시 묻지 않기 위해)
     ?      표에 없음 — <b>영문 그대로</b> 담고 편성은 건드리지 않습니다

   ★ part · group · aside 는 <b>감출 후보이지 감출 것이 아닙니다.</b>
     admin/work-clean.html 에서 사람이 눈으로 고릅니다.
   ============================================================ */
let FORM = {};          /* DB 에서 읽어 채웁니다 */

/* ★ 표를 읽습니다. 200개 상한에 걸리므로 나눠 받습니다
     (지금 161가지지만 늘어날 것입니다). */
async function loadForms() {
  const rows = await getAll('oc_work_forms?select=form_raw,form_ko,genre,kind');
  FORM = {};
  for (const r of rows) {
    FORM[String(r.form_raw || '').trim().toLowerCase()] = {
      ko   : (r.form_ko == null ? null : String(r.form_ko)),
      genre: (r.genre   == null ? null : String(r.genre)),
      kind : String(r.kind || 'work')
    };
  }
  return rows.length;
}

/* 갈래 이름 — 로그에 보여줄 때 씁니다 */
const KIND_KO = {
  work : '음악 작품',
  video: '영상물 (영화·방송)',
  part : '작품의 일부 — 눈으로 봐야 함',
  group: '묶음 항목 — 눈으로 봐야 함',
  aside: '작품이 아님 — 감출 후보',
  broad: '너무 넓음 — 화면에 안 보임',
  '?'  : '번역표에 없음',
};

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
/* ── 나눠 받기 (공용) ────────────────────────────────────────
   ★ PostgREST 는 한 번에 <b>200개까지만</b> 줍니다. limit 을 크게
     줘도 200개만 옵니다.
   ★ 끝냄은 <b>0개일 때만</b> 판단합니다. 「받은 수 < 요청한 수」로
     하면 200개를 받은 첫 바퀴에서 멈춥니다
     (2026-08-07 에 이 실수를 두 번 했습니다).
   ★ offset 은 <b>실제로 받은 수만큼</b> 넘깁니다.
   ★ order 에 흔들리지 않는 칸을 넣으십시오 — 정렬이 바뀌면
     빠지거나 겹칩니다.
   ── 2026-08-08 형식표를 읽는 데도 쓰므로 함수로 뽑았습니다. */
async function getAll(base, max) {
  const PAGE = 200;
  const cap = (max && max > 0) ? max : Infinity;
  const out = [];
  let off = 0;
  while (out.length < cap) {
    const want = Math.min(PAGE, cap - out.length);
    const rows = await sb(`${base}&limit=${want}&offset=${off}`);
    if (!rows || !rows.length) break;    /* 0개일 때만 끝냅니다 */
    out.push(...rows);
    off += rows.length;                  /* 실제로 받은 수만큼 */
  }
  return out;
}

async function pickTargets() {
  let q = 'person_works?select=id,wikidata_id,title,genre,form_raw'
        + '&wikidata_id=not.is.null'
        + '&order=id.asc';
  if (!REDO) q += '&form_raw=is.null';   /* 이미 형식이 있는 것은 넘깁니다 */
  if (!ALL)  q += '&genre=is.null';      /* 편성이 빈 것부터 — 급한 쪽 */
  return getAll(q, LIMIT);
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

/* ★ 여러 형식 가운데 <b>가장 알맞은 것</b>을 고릅니다.

   한 작품에 P31 이 둘 이상 붙는 일이 잦습니다 — 오페라이면서
   극음악이면서 음악 작품, 영화이면서 창작물처럼.

   고르는 순서
     ① 우리가 아는 음악 작품 형식 (교향곡 · 오페라 …)
     ② 우리가 아는 영상물 (영화 …)
     ③ 우리가 아는 묶음 · 작품 아님 (판본 · 음반 …)
     ④ 번역표에 없지만 이름이 있는 것 — 영문 그대로 담습니다
     ⑤ 너무 넓은 말 (musical work/composition)

   ★ ⑤ 를 <b>버리지 않고 마지막으로 고릅니다.</b> 버리면 form_raw
     가 비어 다음에 돌릴 때 같은 것을 또 물어봅니다. */
function pickForm(forms) {
  if (!forms || !forms.length) return null;
  const norm = (s) => String(s || '').trim().toLowerCase();
  const kindOf = (f) => {
    const e = FORM[norm(f.label)];
    if (e) return e.kind;
    return f.label ? '?' : 'none';
  };
  /* ★ part(악장 · 장면)를 group 앞에 둡니다. 「발퀴레의 기행」 이
     movement 와 musical work/composition 을 함께 가지고 올 때
     movement 가 골라져야 발췌임을 알 수 있습니다. */
  const RANK = { work: 1, video: 2, part: 3, group: 4, aside: 5, '?': 6, broad: 7, none: 8 };

  let best = null, bestRank = 99;
  for (const f of forms) {
    const r = RANK[kindOf(f)] || 9;
    if (r < bestRank) { best = f; bestRank = r; }
  }
  return best || forms[0];
}

/* ============================================================
   3) 담기

   ★★ 2026-08-08 이 함수를 통째로 고쳤습니다. 왜 고쳤는지 남깁니다.

   처음에는 이렇게 보냈습니다.

       POST person_works?on_conflict=id
       Prefer: resolution=merge-duplicates
       [{ id, form_raw, form_ko, form_qid }]

   「id 가 같으면 이 네 칸만 고쳐라」 는 뜻으로 쓴 것인데,
   PostgREST 의 이 방식은 <b>보내지 않은 칸을 전부 null 로 채웁니다.</b>
   즉 <b>행 전체를 갈아치웁니다.</b>

       Failing row contains (4387, null, null, null, … , 국가, Q23691)
                                   ↑ person_id · title · opus 가 다 null

   1,998건이 전부 실패했고 <b>person_id 의 not-null 제약이 막아
   주었습니다.</b> 그 제약이 없었다면 작품 1,998개의 내용이 통째로
   날아갔습니다.

   ★ 교훈 — <b>「담는 방식이 무엇을 하는지」 를 확인하십시오.</b>
     문법 · 괄호 · 전각문자 · 표 대조를 다 했지만 이것을 놓쳤습니다.
     주석에 「다른 칸은 건드리지 않습니다」 라고 적어 두었는데
     그 주석이 <b>틀렸습니다.</b> 적어 둔 것이 사실인지 확인해야 합니다.

   ★ 지금은 oc_work_set_form() 을 부릅니다.
     update 문이므로 적지 않은 칸은 손대지 않습니다.
     함수 안에서도 <b>기존 편성을 절대 덮지 않습니다</b>(이중 안전장치).
     ▶ 6-RUN-NOW-form-save-rpc.sql 을 먼저 실행하셔야 합니다.
   ============================================================ */
/* ★ 함수가 돌려준 「고친 줄 수」 를 읽습니다.

   ★ 왜 이렇게까지 하나 — <b>「담김 0개」 라는 로그가 오늘의 사고를
     알려 주었습니다.</b> 셈이 부정확하면 무엇이 잘못됐는지 모릅니다.
     PostgREST 가 스칼라를 그대로 줄 때도 있고 [{함수이름: 값}] 으로
     싸서 줄 때도 있어 양쪽을 다 받습니다. */
function countOf(r, fallback) {
  if (typeof r === 'number') return r;
  if (Array.isArray(r) && r.length && r[0] && typeof r[0] === 'object') {
    const v = Object.values(r[0])[0];
    if (typeof v === 'number') return v;
  }
  return fallback;
}

async function saveRows(rows) {
  let ok = 0;
  const fail = [];

  /* 500건씩 나눠 보냅니다. jsonb 로 싸서 보내므로 묶음이 크면
     요청이 무거워집니다. 함수는 5,000건까지 받습니다. */
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    try {
      const r = await sb('rpc/oc_work_set_form', {
        method: 'POST',
        body: JSON.stringify({ p_rows: part }),
      });
      ok += countOf(r, part.length);
    } catch (e) {
      /* 묶음이 실패하면 한 건씩 다시 담습니다 — 어느 것이 문제인지
         알아야 하기 때문입니다. */
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 건씩 다시 담습니다`);
      console.log(`    (${e.message})`);
      for (const one of part) {
        try {
          const r2 = await sb('rpc/oc_work_set_form', {
            method: 'POST',
            body: JSON.stringify({ p_rows: [one] }),
          });
          ok += countOf(r2, 1);
        } catch (e2) {
          fail.push({ id: one.id, why: e2.message });
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

  /* ★ 형식표를 DB 에서 읽습니다. 이 파일 안에 목록이 없습니다.
     ▶ 7-RUN-NOW-form-table.sql 을 먼저 실행하셔야 합니다. */
  const nForms = await loadForms();
  if (!nForms) {
    console.log('★ 형식표(oc_work_forms)가 비어 있습니다.');
    console.log('  7-RUN-NOW-form-table.sql 을 먼저 실행해 주십시오.');
    console.log('  표가 없으면 형식 이름을 옮기지 못하고 영문 그대로만 담깁니다.');
    return;
  }
  console.log(`형식표 ${nForms}가지를 읽었습니다`);
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
  const kindCount   = new Map();   /* 갈래 → 몇 개 */
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

      /* 번역표를 찾아봅니다. 없으면 <b>영문 그대로</b> 담습니다.
         지어내지 않습니다. */
      const ent = FORM[key];
      if (!ent) noTrans.set(key, (noTrans.get(key) || 0) + works.length);

      const kind = ent ? ent.kind : '?';
      /* ★ 갈래가 broad(너무 넓음)이면 화면에 보일 값은 비웁니다.
           그래도 form_raw · form_qid 는 담습니다 — 그러지 않으면
           다음에 돌릴 때 <b>같은 것을 또 물어봅니다.</b>
           2026-08-07 함정 16번과 같은 낭비입니다. */
      const ko    = ent ? ent.ko : picked.label;
      const genre = ent ? (ent.genre || null) : null;

      kindCount.set(kind, (kindCount.get(kind) || 0) + works.length);

      for (const w of works) {
        gotForm += 1;
        const row = {
          id       : w.id,
          form_raw : picked.label,
          form_ko  : ko || null,
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

  /* ── 갈래별로 묶어 보여줍니다 ─────────────────────────────
     ★ 형식 이름을 한 줄씩 늘어놓으면 예순 줄이 넘어 판단이 안 됩니다.
       갈래로 묶으면 <b>무엇이 작품이고 무엇이 아닌지</b>가 한눈에
       보입니다. 이 도구의 값은 형식 채우기보다 정제에 있습니다. */
  const norm2 = (s) => String(s || '').trim().toLowerCase();
  const kindOfKey = (k) => (FORM[norm2(k)] ? FORM[norm2(k)].kind : '?');

  const bag = new Map();
  for (const [k, v] of formCount.entries()) {
    const kd = kindOfKey(k);
    if (!bag.has(kd)) bag.set(kd, []);
    bag.get(kd).push([k, v]);
  }

  const total = [...formCount.values()].reduce((a, b) => a + b, 0) || 1;
  const pct = (n) => Math.round((n / total) * 1000) / 10;

  console.log('');
  console.log('══ 받은 형식 — 갈래별 ══');
  for (const kd of ['work', 'video', 'part', 'group', 'aside', '?', 'broad']) {
    const items = bag.get(kd);
    if (!items || !items.length) continue;
    const sum = items.reduce((a, b) => a + b[1], 0);
    console.log('');
    console.log(`[${KIND_KO[kd] || kd}]  ${sum}개 (${pct(sum)}%)`);
    items.sort((a, b) => b[1] - a[1]);
    for (const [k, v] of items.slice(0, 25)) {
      const e = FORM[norm2(k)];
      const ko = e ? (e.ko || '(화면에 안 보임)') : '(영문 그대로)';
      const g  = e && e.genre ? ` · 편성 ${e.genre}` : '';
      console.log(`  ${String(v).padStart(6)}  ${k}  →  ${ko}${g}`);
    }
    if (items.length > 25) console.log(`         … 그 밖 ${items.length - 25}가지`);
  }

  if (noTrans.size) {
    console.log('');
    console.log('★ 번역표에 없는 형식 — 이것을 알려 주십시오');
    console.log('  (지금은 영문 그대로 담기고 편성은 건드리지 않습니다)');
    const nt = [...noTrans.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of nt.slice(0, 60)) {
      console.log(`  ${String(v).padStart(6)}  ${k}`);
    }
    if (nt.length > 60) console.log(`  … 그 밖 ${nt.length - 60}가지`);
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  대상 작품            ${targets.length}개`);
  console.log(`  형식을 얻은 것       ${gotForm}개`);
  console.log(`  형식이 없는 것       ${noForm}개`);
  console.log(`  이름이 없어 건너뜀   ${noLabel}개`);
  console.log(`  편성도 함께 채울 것  ${genreFilled}개`);
  console.log(`  형식 가지수          ${formCount.size}가지`);
  console.log('');
  console.log('  ── 갈래 셈 ──');
  for (const kd of ['work', 'video', 'part', 'group', 'aside', '?', 'broad']) {
    const n = kindCount.get(kd);
    if (!n) continue;
    console.log(`  ${String(n).padStart(6)}개  ${KIND_KO[kd] || kd}`);
  }

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
