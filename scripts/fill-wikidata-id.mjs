// ============================================================
// OPUSCLAM 위키데이터 번호(wikidata_id) 자동 채우기
//
//  admin/wikidata-fill.html 의 수동 작업을 자동 실행으로 옮긴 것입니다.
//
// ── 왜 옮기는가 (2026-08-11 · 파트너 말씀에서) ──────────────
//  「어드민에 카드가 스무 개가 넘어 뭐가 뭔지 헷갈린다」
//
//  화면에서 하면 이런 불편이 있습니다.
//   · 창을 닫으면 멈춥니다. 15,000명을 훑는 동안 앉아 계셔야 합니다.
//   · 무엇을 어디까지 했는지 다음에 알 수 없습니다.
//   · 브라우저에서 위키데이터를 부르므로 한 번에 조금씩만 됩니다.
//
// ── 왜 이것을 가장 먼저 옮기는가 ─────────────────────────────
//  wikidata_id 는 <다른 자동화의 전제>입니다.
//   · enrich-persons  — 이 번호가 있는 사람만 보강합니다
//   · photo-wiki      — 이 번호로 사진을 찾습니다
//   · collect-name-ja — 이 번호로 일본어 이름을 받습니다
//  번호가 비어 있으면 그 자동화들이 그 사람을 <아예 건너뜁니다>.
//  즉 이 하나가 막혀 있으면 뒤의 셋이 함께 막힙니다.
//
// ── 사람 판단을 어떻게 대신하나 ─────────────────────────────
//  화면에는 후보를 고르는 눈이 있었습니다. 그것을 그대로 옮겼습니다 —
//  <점수를 매기고, 뚜렷할 때만> 넣습니다.
//
//      점수 6점 이상  그리고  1등이 2등보다 3점 이상 높을 때만
//
//  같은 이름이 여럿이면(1·2등이 비슷하면) <넣지 않습니다>.
//  잘못 이은 번호는 그 뒤의 보강·사진·번역을 모두 엉뚱하게 만들므로,
//  <안 넣는 것이 잘못 넣는 것보다 낫습니다>.
//
//  넣지 않은 것은 admin/wikidata-fill.html 에서 사람이 봅니다.
//  그래서 그 화면은 <남겨 둡니다> — 자동이 못 가린 것만 다루는 자리가 됩니다.
//
// ── 환경변수 ────────────────────────────────────────────────
//  SUPABASE_URL, SUPABASE_SERVICE_KEY
//  OC_TABLES   (선택) 다룰 표 — 쉼표로. 없으면 여섯 갈래 전부
//  OC_LIMIT    (선택) 표마다 몇 명까지 볼지. 없으면 400
//  OC_DRY      (선택) 1 이면 <넣지 않고> 세기만 합니다
// ============================================================

import { makeGetJSON, sleep, isStop, stopReason } from './lib/http.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const DRY   = process.env.OC_DRY === '1';
const LIMIT = Number(process.env.OC_LIMIT || 400);

/* ── 다룰 표 ─────────────────────────────────────────────────
   ★ admin/wikidata-fill.html 의 고르개와 <같은 목록>입니다.
     한쪽을 늘리면 다른 쪽도 늘려 주십시오.
   ★ where 는 「후보 설명에 이 말이 나오면 맞다」 고 볼 칸입니다 —
     단체·공연장은 지역(location), 인물은 국적(nationality)입니다. */
const TABLES = [
  { table: 'foundations',      ko: 'name_ko', en: 'name_en', where: 'location',    label: '기관·재단' },
  { table: 'orgs',             ko: 'name_ko', en: 'name_en', where: 'location',    label: '음악단체' },
  { table: 'venues',           ko: 'name_ko', en: 'name_en', where: 'location',    label: '공연장' },
  { table: 'schools',          ko: 'name_ko', en: 'name_en', where: 'location',    label: '음악학교' },
  { table: 'persons',          ko: 'name_ko', en: 'name_en', where: 'nationality', label: '인물' },
  { table: 'modern_composers', ko: 'name_ko', en: 'name_en', where: 'nationality', label: '현대음악' },
];

/* ── 후보를 가리는 낱말 ──────────────────────────────────────
   ★ admin/wikidata-fill.html 의 GOOD_KIND · BAD_KIND 와 <같아야> 합니다.
     화면과 자동이 서로 다르게 판단하면, 자동이 건너뛴 것을 사람이 보러
     갔을 때 화면이 또 다른 답을 내놓아 헷갈립니다. */
const GOOD_KIND = ['재단','협회','기관','단체','회사','음반','레이블','극장','회관',
  'foundation','association','organization','organisation','institute','institution',
  'company','label','record','theatre','theater','hall','centre','center','society',
  'orchestra','conservatory','conservatoire','school','university','college',
  'competition','festival','concours','trust','council','agency','museum','venue',
  '음악','공연','문화','예술','콩쿠르','페스티벌','오케스트라','학교','대학'];

const BAD_KIND = ['사람','인물','작곡가','연주자','가수','배우','앨범','노래','영화','드라마',
  '마을','도시','군','면','읍','리','역','강','산','섬','책','소설','만화','게임',
  'human','person','composer','musician','singer','actor','album','song','single',
  'film','movie','tv series','village','town','city','district','river','mountain',
  'island','book','novel','manga','video game','station','wikimedia'];

/* ★ 인물 갈래는 BAD_KIND 에서 <사람이라는 말 자체>만 뺍니다.
     그러지 않으면 「대한민국의 작곡가」 라는 설명이 붙은 진짜 작곡가를
     「갈래 어긋남」 으로 깎아 아무도 못 찾습니다.
   ★ 다만 <가수·배우>는 빼지 않습니다 — 우리 DB 는 클래식 인물이므로
     대중가수·배우는 <다른 사람>일 가능성이 큽니다. */
const PERSON_OK = new Set(['사람','인물','작곡가','연주자',
  'human','person','composer','musician']);

/* ★★ 인물 갈래에서 <음악과 무관한 직업>은 크게 깎습니다 ★★
   ─────────────────────────────────────────────────────
   시늉 실행(2026-08-11)에서 드러난 위험입니다 —

     김신    → 「대한민국의 축구 선수」      6점
     김대성  → 「대한민국의 배드민턴 선수」  6점
     신동일  → 「중앙대학교의 영어영문학자」 6점
     이건우  → 「대한민국의 가수」           6점

   이번에는 2등이 있어 「3점 차이」 규칙에 걸려 넘어갔습니다. 그런데
   후보가 <하나뿐이면> 「후보 하나뿐」 +1점을 받아 <7점으로 들어갑니다>.
   재현해 보니 넷 다 들어갔습니다.

   ★ 왜 6점까지 올라가나
     이름 같음 +4, 그리고 국적이 「대한민국」 이라 설명에 그 말이 있으면
     「지역 맞음」 +2 — 운동선수도 대한민국 사람이니 맞아 버립니다.
     신동일은 「중앙대학교」 의 <대학> 이 GOOD_KIND 에 있어 오히려
     「갈래 맞음」 +2 를 받았습니다.

   ★ 잘못 이은 번호는 그 뒤의 보강·사진·번역을 <모두 엉뚱하게> 만듭니다.
     그래서 −8점으로 크게 깎아 확실히 문턱 아래로 내립니다. */
const PERSON_BAD_JOB = [
  /* 운동 */
  '축구','야구','배드민턴','농구','배구','골프','테니스','수영','육상','씨름','태권도',
  '스케이트','체조','유도','권투','복싱','레슬링','선수',
  'footballer','football player','baseball','basketball','volleyball','badminton',
  'golfer','tennis','swimmer','athlete','wrestler','boxer','skater',
  /* 학계·다른 분야 */
  '영어영문학','국문학','법학','의학','공학','물리학','화학','생물학','경제학','경영학',
  '정치인','국회의원','시장','도지사','장관','판사','검사','변호사','의사','기업인','언론인',
  'politician','lawyer','physician','engineer','economist','professor of english',
  'linguist','historian','mathematician','physicist','chemist','biologist',
  /* 대중문화 — 우리 DB 는 클래식입니다 */
  '아이돌','래퍼','트로트','개그맨','코미디언','유튜버','방송인','모델','성우',
  'rapper','idol','comedian','youtuber','tv personality','voice actor','fashion model',
];

/* ★ 옵션 이름을 <짐작하지 않고> scripts/lib/http.mjs 에서 확인했습니다.
     ua · accept · tries · backoff · maxWaitMs · budgetMs 만 받습니다.
     쉬는 틈은 그 파일이 다루지 않으므로 아래에서 sleep 으로 둡니다. */
/* ★ 인물 갈래에서 <음악 하는 사람>임을 알리는 말 — 가점합니다.
     ★ 왜 필요한가 (시늉 실행에서 드러난 것)
       「예뇌 타카스」 → Q261138 「Hungarian composer」 는 <맞는 후보>인데
       1점밖에 받지 못했습니다. 이름 표기가 달라 「이름 같음」 을 못 받고,
       국적이 「헝가리」 인데 설명은 영어라 「지역 맞음」 도 못 받았습니다.
       그런데 「composer」 라는 <가장 뚜렷한 근거>에는 점수가 없었습니다. */
const MUSIC_JOB = [
  '작곡가','지휘자','연주자','성악가','피아니스트','바이올리니스트','첼리스트',
  '음악가','음악학자','오르가니스트','소프라노','테너','바리톤','플루티스트',
  'composer','conductor','pianist','violinist','cellist','organist','flautist','flutist',
  'soprano','tenor','baritone','mezzo-soprano','musicologist','musician',
  'classical', 'opera singer', 'harpsichordist', 'violist',
];

const getJSON = makeGetJSON({
  ua: 'OPUSCLAM/1.0 (https://opusclam.com; cser@wixon.co.kr)',
});

const flat = (v) => String(v == null ? '' : v).toLowerCase()
  .replace(/[\s·,.\-–—'"()[\]]/g, '');

/* ── Supabase 읽기 ───────────────────────────────────────────
   ★ 200행 상한을 반드시 지킵니다.
     받기를 청한 크기로 끝맺음을 판단하면 <첫 쪽에서 멈춥니다>.
     실제로 받은 줄 수로 나아가고, 0줄일 때만 끝냅니다.
     (지난번 15,248명 가운데 200명만 처리하고 「다 했다」 고 한 일이 있었습니다) */
async function loadEmpty(cfg, limit) {
  const out = [];
  let from = 0;
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/${cfg.table}`
      + `?select=*`
      + `&or=(wikidata_id.is.null,wikidata_id.eq.)`
      + `&order=sort_no.desc.nullslast,id.asc`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${from}-${from + 199}`, 'Range-Unit': 'items',
      },
    });
    if (!res.ok) throw new Error(`${cfg.table} 읽기 실패: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;                 /* ★ 0줄일 때만 끝냅니다 */
    out.push(...rows);
    from += rows.length;                     /* ★ 받은 만큼만 나아갑니다 */
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/* ── 위키데이터에서 후보를 찾습니다 ─────────────────────────── */
async function wdSearch(term) {
  if (!term || String(term).trim().length < 2) return [];
  const u = 'https://www.wikidata.org/w/api.php'
    + '?action=wbsearchentities&format=json&origin=*&limit=8&type=item'
    + '&language=ko&uselang=ko&search=' + encodeURIComponent(term);
  /* ★ 두 번째 인자는 <재시도 횟수>입니다 (라벨이 아닙니다).
       처음에는 이름표를 넘겼는데, 그러면 문자열이 횟수로 쓰여 어긋납니다. */
  const j = await getJSON(u);
  await sleep(220);                        /* 위키데이터에 숨 돌릴 틈 */
  const list = (j && j.search) || [];
  return list.map(x => ({
    qid: x.id,
    label: x.label || '',
    desc: x.description || '',
  }));
}

/* ── 후보에 점수를 매깁니다 ──────────────────────────────────
   ★ admin/wikidata-fill.html 의 scoreCand 와 <같은 규칙>입니다. */
function scoreCand(row, cfg, c, only) {
  let sc = 0; const why = [];
  const a  = flat(row[cfg.ko]);
  const b  = flat(row[cfg.en]);
  const lb = flat(c.label);
  const desc = String(c.desc || '').toLowerCase();

  if (lb && (lb === a || lb === b)) { sc += 4; why.push('이름 같음'); }
  else if (lb && a && (lb.includes(a) || a.includes(lb))) { sc += 2; why.push('이름 비슷'); }
  else if (lb && b && (lb.includes(b) || b.includes(lb))) { sc += 2; why.push('영문 비슷'); }

  /* 우리가 아는 지역·국적이 설명에 나오나 */
  const where = String(row[cfg.where] || '');
  for (const w of where.split(/[\s·,]+/).filter(x => x.length >= 2)) {
    if (desc.includes(w.toLowerCase())) { sc += 2; why.push('지역 맞음'); break; }
  }

  if (desc) {
    const isPerson = (cfg.table === 'persons' || cfg.table === 'modern_composers');

    /* ★ 인물 갈래에서 <음악과 무관한 직업>이면 먼저 크게 깎습니다.
         가점보다 먼저 보아, 「중앙대학교의 영어영문학자」 처럼 「대학」 이
         들어 있어 가점까지 받는 일을 막습니다. */
    let badJob = false;
    if (isPerson) {
      for (const j of PERSON_BAD_JOB) {
        if (desc.includes(j)) { sc -= 8; why.push('★ 음악과 무관한 직업'); badJob = true; break; }
      }
    }

    if (!badJob) {
      for (const g of GOOD_KIND) {
        if (desc.includes(g)) { sc += 2; why.push('갈래 맞음'); break; }
      }
    }

    /* ★ 인물 갈래에서 <음악 하는 사람>이면 가점합니다.
         「Hungarian composer」 인 진짜 작곡가(예뇌 타카스)가 1점밖에
         못 받아 놓치던 것을 고칩니다. */
    if (isPerson && !badJob) {
      for (const m of MUSIC_JOB) {
        if (desc.includes(m)) { sc += 3; why.push('음악 하는 사람'); break; }
      }
    }

    for (const d of BAD_KIND) {
      if (isPerson && PERSON_OK.has(d)) continue;   /* ★ 인물은 사람 낱말을 깎지 않습니다 */
      if (desc.includes(d)) { sc -= 4; why.push('★ 갈래 어긋남'); break; }
    }
  } else {
    why.push('설명 없음');
  }

  /* ★★ 이름 표기가 다르면 <넣지 않습니다> ★★

     ─────────────────────────────────────────────────────

     시늉 실행에서 이런 경우가 나왔습니다 —

  

       「예뇌 타카스」  ↔  Jenő Takács      (Hungarian composer)

       「노르망 록우드」 ↔  Normand Lockwood  (American classical composer)

  

     둘 다 <맞는 후보>입니다. 그런데 한글 표기와 원어가 달라

     「이름 같음」 을 받지 못해 4점에 머물렀습니다.

  

     ★ 점수를 더 주어 넣게 할 수도 있었지만 <그러지 않았습니다>.

       이름이 맞는지 <기계가 확인할 길이 없기> 때문입니다.

       「Hungarian composer」 라는 설명만으로는, 그 사람이 우리가

       찾는 「예뇌 타카스」 인지 <같은 나라의 다른 작곡가>인지

       가릴 수 없습니다. 헝가리 작곡가는 여럿입니다.

  

     ★ 두 방향의 위험을 견주면 —

         넣지 않으면  사람이 화면에서 보고 넣습니다 (손이 좀 갑니다)

         잘못 넣으면  보강·사진·번역이 <모두 엉뚱한 사람 것>이 되고,

                      그 뒤에 아무도 알아채지 못합니다

       그래서 <이름이 뚜렷할 때만> 넣습니다. */

  if (only) { sc += 1; why.push('후보 하나뿐'); }
  return { score: sc, why: why.join(' · ') };
}

/* ── 넣습니다 ────────────────────────────────────────────────
   ★ 넣기 직전에 <그 줄이 아직 비어 있는지> 다시 봅니다.
     이 스크립트가 도는 동안 사람이 화면에서 채웠을 수 있습니다.
     그것을 덮어쓰면 사람이 살펴 넣은 값을 잃습니다. */
async function saveOne(table, id, qid) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
    + `&or=(wikidata_id.is.null,wikidata_id.eq.)`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify({ wikidata_id: qid }),
  });
  if (!res.ok) throw new Error(`넣기 실패 ${table}#${id}: ${res.status} ${await res.text()}`);
  const back = await res.json();
  return Array.isArray(back) && back.length > 0;   /* 0이면 그새 채워진 것 */
}

/* ── 한 갈래 처리 ────────────────────────────────────────────── */
async function runTable(cfg) {
  const rows = await loadEmpty(cfg, LIMIT);
  console.log(`\n■ ${cfg.label} (${cfg.table}) — 번호가 빈 자료 ${rows.length}건`);
  if (!rows.length) return { seen: 0, put: 0, skip: 0, none: 0 };

  let put = 0, skip = 0, none = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row[cfg.ko] || row[cfg.en];
    if (!name || String(name).trim().length < 2) { none++; continue; }

    let cands = [];
    try {
      cands = await wdSearch(name);
      /* 한국어로 못 찾으면 원어 이름으로 한 번 더 */
      if (!cands.length && row[cfg.en] && row[cfg.en] !== name) {
        cands = await wdSearch(row[cfg.en]);
      }
    } catch (e) {
      if (isStop(e)) { console.log(`  ⏸ 멈춤: ${stopReason()}`); break; }
      console.log(`  · ${name} — 찾기 실패: ${e.message}`);
      continue;
    }

    if (!cands.length) { none++; continue; }

    const only = cands.length === 1;
    for (const c of cands) {
      const v = scoreCand(row, cfg, c, only);
      c.score = v.score; c.why = v.why;
    }
    cands.sort((x, y) => y.score - x.score);

    /* ★ 뚜렷할 때만 넣습니다 — 화면과 같은 문턱입니다.
         1등이 6점 이상이고, 2등보다 3점 이상 높을 때만.
         같은 이름이 여럿이면 넘깁니다. */
    const top = cands[0];
    const clear = top.score >= 6
      && (cands.length === 1 || top.score - cands[1].score >= 3);

    if (!clear) {
      skip++;
      if (skip <= 5) {
        console.log(`  · 넘김 ${name} — 1등 ${top.score}점(${top.qid} ${top.desc || '설명 없음'})`
          + (cands[1] ? ` / 2등 ${cands[1].score}점` : ''));
      }
      continue;
    }

    if (DRY) { put++; console.log(`  (시늉) ${name} → ${top.qid} ${top.score}점 · ${top.why}`); continue; }

    try {
      const ok = await saveOne(cfg.table, row.id, top.qid);
      if (ok) { put++; if (put <= 8) console.log(`  ✓ ${name} → ${top.qid} (${top.score}점 · ${top.why})`); }
      else    { skip++; console.log(`  · ${name} — 그새 사람이 채웠습니다`); }
    } catch (e) {
      console.log(`  ✘ ${name} — ${e.message}`);
    }

    await sleep(60);
  }

  console.log(`  → 넣음 ${put} · 넘김 ${skip} · 후보 없음 ${none}`);
  return { seen: rows.length, put, skip, none };
}

/* ── 시작 ────────────────────────────────────────────────────── */
(async () => {
  const want = (process.env.OC_TABLES || '').split(',').map(s => s.trim()).filter(Boolean);
  const list = want.length ? TABLES.filter(t => want.includes(t.table)) : TABLES;
  if (!list.length) { console.error('다룰 표가 없습니다. OC_TABLES 를 확인해 주십시오.'); process.exit(1); }

  console.log('═══ 위키데이터 번호 채우기 ═══');
  console.log(`  표 ${list.length}개 · 표마다 최대 ${LIMIT}건` + (DRY ? ' · 시늉만(넣지 않음)' : ''));

  const sum = { seen: 0, put: 0, skip: 0, none: 0 };
  for (const cfg of list) {
    try {
      const r = await runTable(cfg);
      sum.seen += r.seen; sum.put += r.put; sum.skip += r.skip; sum.none += r.none;
    } catch (e) {
      if (isStop(e)) { console.log(`⏸ 멈춤: ${stopReason()}`); break; }
      console.error(`✘ ${cfg.label}: ${e.message}`);
    }
  }

  console.log('\n═══ 마침 ═══');
  console.log(`  살펴본 자료 ${sum.seen}건`);
  console.log(`  번호 넣음  ${sum.put}건`);
  console.log(`  넘김       ${sum.skip}건  ← 헷갈리는 것입니다. admin/wikidata-fill.html 에서 사람이 봅니다`);
  console.log(`  후보 없음  ${sum.none}건`);
  if (sum.put === 0 && sum.seen > 0) {
    console.log('\n  ※ 하나도 넣지 못했습니다. 문턱이 높거나 이름이 위키데이터와 다를 수 있습니다.');
  }
})();
