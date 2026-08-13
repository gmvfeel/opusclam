// ============================================================
// OPUSCLAM 인물DB · 클래식 무관 후보 찾기
//   scripts/audit-person-classic.mjs · 2026-08-13
//
// ── 왜 필요한가 ─────────────────────────────────────────────
//  2026-08-13 확인 — 「가장 알려진 57명」을 뽑았더니 그중 10명이 클래식
//  음악인이 아니었습니다. F1 경주 선수(피아노를 잘 쳤음), 외과의사
//  (브람스의 친구), 소설가, 발명가, 발레 교육자, 팝 가수…
//  위키데이터에서 「음악 관련 낱말이 걸린 사람」을 받아 왔기 때문입니다.
//
// ── 이 스크립트는 아무것도 지우지 않습니다 ──────────────────
//  후보와 근거만 oc_person_audit 표에 담습니다.
//  숨기는 것은 admin/person-audit.html 에서 사람이 봅니다.
//  ★ 지난 학술DB 정리에서 배운 것입니다 — 판단이 필요한 일은
//    SQL 자동판정 대신 도구를 만듭니다. 범위를 넓히려 할 때마다
//    오판이 생겼습니다.
//
// ── 무엇을 근거로 삼나 ──────────────────────────────────────
//  위키데이터 직업(P106)입니다. 인물 판정에는 이것이 가장 정확합니다.
//  scripts/lib/classic.mjs 는 장르·작품 낱말로 판정하는 체계라
//  인물에는 맞지 않습니다 (그쪽은 작품·학술에 씁니다).
//
//  직업 이름(영문 라벨)으로 봅니다. QID 로 하면 목록을 외워야 하고
//  빠진 것을 알 수 없는데, 라벨은 로그에 그대로 남아 사람이 확인할 수
//  있습니다.
//
//  ㉮ 음악 직업이 하나도 없음        → 후보 (reason: 음악직업없음)
//     보기 — Formula One driver · surgeon · novelist · inventor
//  ㉯ 음악 직업이 애매한 것뿐이고 대중음악 직업이 함께 있음
//                                    → 후보 (reason: 대중음악만)
//     보기 — singer + pop singer · guitarist + rock musician
//
// ── 담지 않는 것 ────────────────────────────────────────────
//  · 위키데이터에 직업(P106)이 아예 없는 사람
//    근거가 없이 의심하면 목록이 쓸모없어집니다. 숫자만 로그에 남깁니다.
//  · 이미 사람이 판정한 사람(status 가 pending 이 아님)
//  · 이미 숨겨진 사람
//
// ── 환경변수 ────────────────────────────────────────────────
//  SUPABASE_URL, SUPABASE_SERVICE_KEY   (필수)
//  DAILY_LIMIT   (선택) 이번 실행에서 물어볼 인물 수 · 기본 3000
//  DRY_RUN       (선택) 1 이면 담지 않고 무엇이 후보인지만 봅니다
// ============================================================

import { makeGetJSON, sleep, isStop, stopReason, budgetLeftMin } from './lib/http.mjs';
import { readJson } from './lib/json.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAILY_LIMIT  = parseInt(process.env.DAILY_LIMIT || '3000', 10);
const DRY_RUN      = process.env.DRY_RUN === '1';
const WD_SPARQL    = process.env.WD_SPARQL || 'https://query.wikidata.org/sparql';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};
const getJSON = makeGetJSON({ accept: 'application/sparql-results+json' });

/* ── 직업 이름 사전 ──────────────────────────────────────────
   ★ 낱말이 <b>들어 있으면</b> 걸립니다(부분 일치). 그래서
     'classical composer' · 'film composer' 도 composer 로 걸립니다.
   ★ 순서가 중요합니다 — POP 을 먼저 봅니다. 'singer-songwriter' 는
     'singer' 도 품고 있으므로 POP 을 먼저 걸러야 합니다. */

/* 클래식·순수음악 쪽이 뚜렷한 직업 */
const CLASSIC = [
  'composer', 'conductor', 'kapellmeister', 'choirmaster', 'concertmaster',
  'opera singer', 'operatic', 'soprano', 'mezzo-soprano', 'contralto',
  'tenor', 'baritone', 'countertenor', 'castrato',
  'pianist', 'organist', 'harpsichordist', 'violinist', 'violist', 'cellist',
  'double bass', 'harpist', 'lutenist', 'guitarist (classical)',
  'flautist', 'flutist', 'oboist', 'clarinetist', 'clarinettist', 'bassoonist',
  'trumpeter', 'hornist', 'trombonist', 'tubist', 'percussionist', 'timpanist',
  'accordionist', 'carillonneur', 'organ builder',
  'musicologist', 'music theorist', 'music historian', 'music critic',
  'music teacher', 'music pedagogue', 'music educator', 'music publisher',
  'librettist', 'music director', 'ethnomusicologist',
  'church musician', 'cantor', 'instrument maker', 'luthier',
];

/* 대중음악 쪽이 뚜렷한 직업 — 이것만 있으면 순수음악 포털의 몫이 아닙니다 */
const POP = [
  'singer-songwriter', 'songwriter', 'rapper', 'disc jockey', 'dj',
  'record producer', 'pop singer', 'rock musician', 'jazz',
  'drummer', 'bassist', 'beatmaker', 'idol', 'hip hop',
  'blues', 'country singer', 'folk singer', 'gospel',
];

/* 음악이기는 하나 이것만으로는 클래식이라 할 수 없는 직업 */
const WEAK = ['singer', 'musician', 'guitarist', 'music', 'performer', 'artist'];

/* 음악 밖이 뚜렷한 직업 — 음악 직업과 함께 있으면 「겸업의심」이 됩니다.
   ★ 여기에 무엇을 넣지 <b>않는지</b>가 더 중요합니다.
     'university teacher' · 'writer' · 'priest' · 'monk' · 'actor' 는
     넣지 않습니다 — 정당한 음악가에게 흔히 붙어 있어서 넣으면
     목록이 온통 통과해야 할 사람으로 채워집니다.
   ★ 이 갈래는 <b>지우자는 뜻이 아닙니다.</b> 보로딘(작곡가 + 화학자)처럼
     둘 다인 사람이 있으므로 사람이 봐야 합니다. */
const OUTSIDE = [
  'racing', 'driver', 'surgeon', 'physician', 'dentist', 'nurse',
  'engineer', 'inventor', 'physicist', 'chemist', 'mathematician',
  'astronomer', 'astrologer', 'biologist', 'geologist',
  'politician', 'diplomat', 'ambassador', 'military', 'soldier',
  'lawyer', 'judge', 'barber', 'merchant', 'banker', 'farmer',
  'athlete', 'footballer', 'tennis', 'boxer', 'chess', 'aviator', 'pilot',
  'architect', 'ballet dancer', 'choreographer', 'activist',
];

const lc = (s) => String(s || '').toLowerCase();
const hitAny = (label, list) => list.some((w) => lc(label).includes(w));

/* 한 사람의 직업 목록을 보고 갈래를 정합니다.
   돌려주는 값: null(문제 없음) 또는 { reason } */
function judge(occ) {
  if (!occ.length) return null;                     // 근거 없음 — 담지 않습니다
  const hasClassic = occ.some((o) => hitAny(o, CLASSIC));
  if (hasClassic) {
    /* ★ 음악 직업이 있어도 음악 밖의 직업이 함께 있으면 사람이 봐야 합니다.
         F1 경주 선수인데 피아노를 잘 쳤다고 pianist 가 붙은 사람,
         발명가인데 첼로를 켰다고 cellist 가 붙은 사람이 그렇습니다.
         반대로 보로딘은 작곡가이면서 화학자입니다 — 그래서 지우지 않고
         묻습니다. */
    if (occ.some((o) => hitAny(o, OUTSIDE))) return { reason: '겸업의심' };
    return null;
  }

  const hasPop  = occ.some((o) => hitAny(o, POP));
  const hasWeak = occ.some((o) => hitAny(o, WEAK));

  if (hasPop) return { reason: '대중음악만' };
  if (hasWeak) return null;                         // 애매한 것만 — 의심하지 않습니다
  return { reason: '음악직업없음' };
}

/* ── Supabase ───────────────────────────────────────────────
   ★ 받은 만큼 다음 자리를 옮깁니다 (200줄 상한). */
async function sbGetAll(table, select, filter) {
  const out = [];
  const STEP = 1000;
  let from = 0;
  for (;;) {
    const url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (filter || '');
    const r = await fetch(url, { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) {
      console.error('  ✗ 조회 실패 ' + r.status + ' — ' + (await r.text()).slice(0, 200));
      throw new Error('GET ' + r.status);
    }
    const batch = await readJson(r);
    if (!batch.length) break;
    out.push(...batch);
    from += batch.length;
    if (out.length > 200000) break;
  }
  return out;
}

/* 후보를 담습니다 — 한 사람에 한 줄이므로 있으면 덮어씁니다.
   ★ on_conflict 는 유일 자리 이름이 아니라 <b>칸 이름</b>을 줍니다. */
async function sbUpsert(rows) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/oc_person_audit?on_conflict=person_id', {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error('POST ' + r.status + ' — ' + (await r.text()).slice(0, 200));
}

const qidOf = (u) => (u ? String(u).split('/').pop() : '');
const val   = (b, k) => (b && b[k] && b[k].value) ? b[k].value : '';

/* ── 위키데이터에서 직업(P106) 가져오기 ─────────────────────── */
async function fetchP106(qids) {
  const values = qids.map((q) => 'wd:' + q).join(' ');
  const q = `SELECT ?item ?occEn WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P106 ?occ .
  ?occ rdfs:label ?occEn . FILTER(LANG(?occEn)="en")
}`;
  const url = WD_SPARQL + '?format=json&query=' + encodeURIComponent(q);
  const j = await getJSON(url);
  const out = new Map();
  for (const b of ((j && j.results && j.results.bindings) || [])) {
    const item = qidOf(val(b, 'item'));
    const occ  = val(b, 'occEn');
    if (!item || !occ) continue;
    const list = out.get(item) || [];
    if (!list.includes(occ)) list.push(occ);
    out.set(item, list);
  }
  return out;
}

async function main() {
  console.log('── OPUSCLAM 인물DB 클래식 무관 후보 찾기 ──');
  console.log('   이번 실행 한도: ' + DAILY_LIMIT + '명'
    + (DRY_RUN ? '  · 미리보기만(담지 않습니다)' : ''));
  console.log('   ★ 아무것도 지우지 않습니다. 후보와 근거만 담습니다.');

  /* ① 이미 사람이 판정한 사람은 건너뜁니다 */
  console.log('■ 이미 판정한 사람 확인');
  let decided = new Set();
  try {
    const done = await sbGetAll('oc_person_audit', 'person_id,status', '&status=neq.pending');
    decided = new Set(done.map((r) => r.person_id));
    console.log('   이미 판정 ' + decided.size + '명 — 건너뜁니다');
  } catch (e) {
    console.log('   ✗ oc_person_audit 를 읽지 못했습니다 — 표를 먼저 만드셨는지 보십시오');
    throw e;
  }

  /* ② 대상 — 숨기지 않은, 위키데이터 번호가 있는 인물
        ★ sort_no 큰 순서로 — 널리 알려진 인물이 화면에 먼저 보이므로
          그쪽의 잘못이 더 크게 눈에 띕니다. */
  console.log('■ 대상 조회');
  const all = await sbGetAll('persons', 'id,name_ko,name_en,field,life,sort_no,wikidata_id',
    '&wikidata_id=not.is.null&hidden=is.false&order=sort_no.desc.nullslast,id.asc');
  const targets = all.filter((p) => !decided.has(p.id)).slice(0, DAILY_LIMIT);
  console.log('   숨기지 않은 · 번호가 있는 인물 : ' + all.length + '명');
  console.log('   이번에 물어볼 인물            : ' + targets.length + '명');
  if (!targets.length) { console.log('✅ 볼 것이 없습니다.'); return; }

  /* ③ 위키데이터 조회 · 판정 */
  const STEP = 150;
  console.log('■ 위키데이터에서 직업 조회 (' + STEP + '명씩)');
  const found = [];
  let asked = 0, noOcc = 0, pass = 0;

  for (let i = 0; i < targets.length; i += STEP) {
    const why = stopReason();
    if (why) { console.log('   ⏸ 바깥 자료원이 막혀 멈춥니다 — ' + why); break; }

    const part = targets.slice(i, i + STEP);
    let map = new Map();
    try {
      map = await fetchP106(part.map((p) => p.wikidata_id));
    } catch (e) {
      if (isStop(e)) { console.log('   ⏸ ' + (e.message || e)); break; }
      console.log('   ✗ 묶음 조회 실패 — 건너뜁니다: ' + (e.message || e));
      continue;
    }
    asked += part.length;

    for (const p of part) {
      const occ = map.get(p.wikidata_id) || [];
      if (!occ.length) { noOcc++; continue; }
      const v = judge(occ);
      if (!v) { pass++; continue; }
      found.push({
        person_id: p.id,
        reason: v.reason,
        occupations: occ.slice(0, 12).join(', '),
        status: 'pending',
        _who: (p.name_ko || p.name_en || ('#' + p.id)),
        _sort: p.sort_no || 0,
      });
    }

    if (i % 600 < STEP) {
      console.log('   ' + Math.min(i + STEP, targets.length) + '/' + targets.length
        + ' · 후보 ' + found.length + ' · 남은 예산 ' + budgetLeftMin() + '분');
    }
    await sleep(400);
  }

  console.log('   ▶ 물어본 인물 ' + asked + '명');
  console.log('     클래식 뚜렷      ' + pass + '명');
  console.log('     직업 기록이 없음 ' + noOcc + '명 (근거가 없어 담지 않습니다)');
  console.log('     후보             ' + found.length + '명');

  /* ④ 미리보기 — 알려진 순서로 앞 40명. 로그에 남겨 근거가 되게 합니다. */
  found.sort((a, b) => b._sort - a._sort || a.person_id - b.person_id);
  console.log('■ 후보 미리보기 (알려진 순 앞 40명)');
  found.slice(0, 40).forEach((f) =>
    console.log('   · ' + f._who + ' (#' + f.person_id + ' · ' + f.reason + ') — ' + f.occupations));

  const byReason = {};
  found.forEach((f) => { byReason[f.reason] = (byReason[f.reason] || 0) + 1; });
  console.log('   갈래 — ' + Object.entries(byReason).map(([k, v]) => k + ' ' + v + '명').join(' · '));

  if (DRY_RUN) { console.log('✅ 미리보기만 했습니다 (DRY_RUN=1).'); return; }
  if (!found.length) { console.log('✅ 담을 후보가 없습니다.'); return; }

  /* ⑤ 담기 — 200줄씩 */
  console.log('■ 후보 담기');
  let ok = 0;
  for (let i = 0; i < found.length; i += 200) {
    const part = found.slice(i, i + 200).map((f) => ({
      person_id: f.person_id, reason: f.reason,
      occupations: f.occupations, status: f.status,
    }));
    try { await sbUpsert(part); ok += part.length; }
    catch (e) { console.log('   ✗ 담기 실패 — ' + (e.message || e)); }
  }

  console.log('✅ 완료 — 후보 ' + ok + '명을 담았습니다.');
  console.log('   어드민 → 인물 무관 후보 검토 화면에서 보십시오.');
  console.log('   ※ 아무도 숨겨지지 않았습니다. 숨기는 것은 화면에서 사람이 합니다.');
}

main().catch((e) => {
  if (isStop(e)) { console.log('■ 자료원이 막혀 여기까지 · 다음 실행에 이어서'); return; }
  console.error('✗ 중단: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
