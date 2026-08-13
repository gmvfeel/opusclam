/* ============================================================
   OPUSCLAM · 오늘의 SELF PR · 이달의 음악학교 자동 선정
   scripts/pick-daily.mjs · 2026-08-13

   ★ 무엇을 하나
     ① daily_self_pr — 날마다 인물 한 사람을 골라 담습니다
     ② monthly_school — 달마다 학교 한 곳을 골라 담습니다
     둘 다 이미 담긴 날·달은 건너뜁니다. 여러 번 돌려도 안전합니다.

   ★ 어떻게 고르나 — 「화면이 실제로 보여주는 것」을 점수로 셉니다
     community/selfpr.html 이 그리는 것 : 사진 · 국문소개 · 영문소개 ·
     작품 · 수상 · 위키/음원/영상 단추. 그래서 그것들에 점수를 줍니다.
     ★ 사진이 없는 인물은 <b>아예 후보에서 뺍니다</b> — SELF PR 은 사진이
       가장 큰 자리를 차지해 비면 화면이 무너집니다.
     ★ 소개문이 없는 인물도 뺍니다 — 읽을 것이 없습니다.
     ★ 이미 나온 사람은 다시 고르지 않습니다(daily_self_pr 기록 전체를 봅니다).

   ★ 손으로 쓴 것은 건드리지 않습니다
     is_manual 칸이 있으면 그 값이 true 인 줄은 덮어쓰지 않습니다.

   ★ 쓰는 법
     node scripts/pick-daily.mjs                    오늘·이번 달 (없으면 담기)
     node scripts/pick-daily.mjs --fill-past=15     15일 전부터 오늘까지 메우기
     node scripts/pick-daily.mjs --ymd=2026-08-01   그 날만
     node scripts/pick-daily.mjs --ym=2026-07       그 달만
     node scripts/pick-daily.mjs --only=person      인물만 (school 이면 학교만)
     node scripts/pick-daily.mjs --dry              담지 않고 무엇을 고를지만 보기

   ★ 날짜는 <b>한국 시각</b> 기준입니다. GitHub Actions 는 UTC 로 돌아서
     그냥 new Date() 를 쓰면 오전 9시 전에는 어제 날짜가 됩니다.

   ★ Supabase 200행 상한
     PostgREST 는 한 번에 200줄까지만 줍니다. 받은 줄 수만큼 앞으로
     나아가고(from += rows.length) 0줄이 오면 멈춥니다.
     받기로 한 수와 비교해 멈추면 첫 장에서 끝나 버립니다.
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
            || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 옵션 읽기 ──────────────────────────────────────────── */
const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const DRY       = !!ARGS.dry;
const FILL_PAST = /^\d+$/.test(String(ARGS['fill-past'])) ? Number(ARGS['fill-past']) : 0;
const ONE_YMD   = /^\d{4}-\d{2}-\d{2}$/.test(String(ARGS.ymd)) ? String(ARGS.ymd) : null;
const ONE_YM    = /^\d{4}-\d{2}$/.test(String(ARGS.ym)) ? String(ARGS.ym) : null;
const ONLY      = ARGS.only === 'person' || ARGS.only === 'school' ? ARGS.only : null;

/* ── 한국 시각 날짜 ─────────────────────────────────────── */
const KST_MS = 9 * 3600 * 1000;
function kstYmd(offsetDays = 0) {
  const t = Date.now() + KST_MS - offsetDays * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
const TODAY = kstYmd(0);
const THIS_YM = TODAY.slice(0, 7);

/* ── Supabase REST ──────────────────────────────────────── */
const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

async function sbGet(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: HDR });
  if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status + ' ' + (await r.text()));
  return r.json();
}

/** 200행 상한을 넘어 전부 받아옵니다. path 에 order 를 반드시 넣으십시오. */
async function sbAll(path, cap = 80000) {
  const out = [];
  let from = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const r = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: { ...HDR, 'Range-Unit': 'items', Range: from + '-' + (from + 199) },
    });
    if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status + ' ' + (await r.text()));
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;   // ★ 0줄이면 끝
    out.push(...rows);
    from += rows.length;                                    // ★ 실제 받은 만큼
    if (out.length >= cap) break;
  }
  return out;
}

async function sbInsert(table, row) {
  const r = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: { ...HDR, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('POST ' + table + ' → ' + r.status + ' ' + (await r.text()));
  return r.json();
}

/** 그 표에 어떤 칸이 있는지 한 줄 받아 알아봅니다.
    is_manual · note 처럼 있을 수도 없을 수도 있는 칸을 안전하게 다루기 위해서입니다.
    줄이 하나도 없으면 빈 목록이 오므로, 그때는 꼭 필요한 칸만 씁니다. */
async function columnsOf(table) {
  try {
    const rows = await sbGet(table + '?select=*&limit=1');
    return rows.length ? Object.keys(rows[0]) : [];
  } catch { return []; }
}

const has = (v) => typeof v === 'string' && v.trim() !== '';
const len = (v) => (has(v) ? v.trim().length : 0);

/* ════════════════════════════════════════════════════════════
   ① 오늘의 SELF PR
   ════════════════════════════════════════════════════════════ */

/* 점수 — 화면이 보여주는 것에 무게를 둡니다.
   국문 소개가 가장 귀합니다(1,716명뿐). 그다음이 영문 소개입니다. */
function scorePerson(p) {
  let s = 0;
  const ko = len(p.description), en = len(p.description_en);

  if (ko >= 400) s += 44; else if (ko >= 200) s += 34;
  else if (ko >= 100) s += 24; else if (ko >= 40) s += 14;

  if (en >= 400) s += 20; else if (en >= 200) s += 15;
  else if (en >= 100) s += 10; else if (en >= 40) s += 5;

  if (has(p.field))       s += 4;
  if (has(p.instrument))  s += 4;
  if (has(p.nationality)) s += 3;
  if (has(p.life))        s += 3;
  if (has(p.era_name))    s += 2;
  if (has(p.school))      s += 3;
  if (has(p.works))       s += 5;

  if (/^https?:\/\//.test(p.link_wiki  || '')) s += 4;
  if (/^https?:\/\//.test(p.link_audio || '')) s += 7;
  if (/^https?:\/\//.test(p.link_video || '')) s += 7;

  if (has(p.image_url)) s += 6;   // 인물DB 자체 사진이면 더 확실합니다
  return s;
}

async function pickPersons() {
  /* ── 이미 나온 사람 · 이미 담긴 날 ───────────────────────── */
  const cols = await columnsOf('daily_self_pr');
  const hasManual = cols.includes('is_manual');
  const hasNote   = cols.includes('note');

  const hist = await sbAll('daily_self_pr?select=' +
    ['ymd', 'person_id', hasManual ? 'is_manual' : null].filter(Boolean).join(',') +
    '&order=ymd.asc');
  const doneYmd = new Set(hist.map((r) => r.ymd));
  const usedPid = new Set(hist.map((r) => r.person_id).filter(Boolean));

  /* ── 채울 날짜 정하기 ───────────────────────────────────── */
  let days = [];
  if (ONE_YMD) days = [ONE_YMD];
  else if (FILL_PAST > 0) {
    for (let i = FILL_PAST - 1; i >= 0; i--) days.push(kstYmd(i));
  } else days = [TODAY];
  days = days.filter((d) => !doneYmd.has(d));

  if (!days.length) {
    console.log('[SELF PR] 채울 날이 없습니다 (모두 이미 담겨 있습니다).');
    return;
  }
  console.log('[SELF PR] 채울 날 ' + days.length + '일 : ' + days[0] + ' ~ ' + days[days.length - 1]);

  /* ── 후보 모으기 ────────────────────────────────────────
       소개문이 하나라도 있는 인물만 받습니다. 15,255명 전부를 받으면
       헛일이 많습니다.                                                */
  const SEL = 'id,name_ko,name_en,field,instrument,nationality,life,era_name,' +
              'school,works,description,description_en,image_url,link_wiki,link_audio,link_video';
  const people = await sbAll('persons?select=' + SEL +
    '&or=(description.not.is.null,description_en.not.is.null)&order=id.asc');
  console.log('  소개문이 있는 인물 ' + people.length + '명');

  /* ── 사진 — 인물DB 사진이 없으면 모아둔 사진을 봅니다 ───── */
  const photoIds = new Set(
    (await sbAll('entity_photo_main?select=entity_id&entity_type=eq.person&order=entity_id.asc'))
      .map((r) => r.entity_id)
  );

  let cand = people.filter((p) =>
    has(p.name_ko) &&
    (len(p.description) >= 40 || len(p.description_en) >= 40) &&
    (has(p.image_url) || photoIds.has(p.id)) &&
    !usedPid.has(p.id)
  );
  console.log('  사진·소개문을 갖춘 새 후보 ' + cand.length + '명');
  if (!cand.length) {
    console.log('  ■ 후보가 없습니다 — 아무것도 담지 않았습니다.');
    return;
  }

  cand.forEach((p) => { p._base = scorePerson(p); });
  cand.sort((a, b) => b._base - a._base || a.id - b.id);

  /* ── 앞선 후보만 작품·수상을 세어 점수를 더합니다 ─────────
       15,000명 전부를 세면 요청이 수백 번 됩니다. 어차피 위쪽에서만
       고르므로 넉넉히 앞 120명만 셉니다.                              */
  const top = cand.slice(0, Math.max(120, days.length * 4));
  const ids = top.map((p) => p.id);
  const chunk = (arr, n) => arr.reduce((a, v, i) =>
    (i % n ? a[a.length - 1].push(v) : a.push([v]), a), []);

  const wCount = new Map(), aCount = new Map();
  for (const g of chunk(ids, 60)) {
    const inList = '(' + g.join(',') + ')';
    for (const [tbl, map] of [['person_works', wCount], ['person_awards', aCount]]) {
      const rows = await sbAll(tbl + '?select=person_id&person_id=in.' + inList +
                               '&hidden=not.is.true&order=person_id.asc');
      rows.forEach((r) => map.set(r.person_id, (map.get(r.person_id) || 0) + 1));
    }
  }
  top.forEach((p) => {
    p._score = p._base
      + Math.min(wCount.get(p.id) || 0, 12) * 2
      + Math.min(aCount.get(p.id) || 0, 10) * 3;
  });
  top.sort((a, b) => b._score - a._score || a.id - b.id);

  /* ── 날짜에 하나씩 배정 ─────────────────────────────────
       오래된 날부터 채우고, 앞선 사람부터 씁니다.                    */
  const queue = top.concat(cand.slice(top.length));
  let qi = 0;
  for (const ymd of days) {
    while (qi < queue.length && usedPid.has(queue[qi].id)) qi++;
    if (qi >= queue.length) { console.log('  ■ 후보가 모자랍니다 — ' + ymd + ' 이후를 비웁니다.'); break; }
    const p = queue[qi++];
    usedPid.add(p.id);

    const row = { ymd, person_id: p.id, score: Math.round(p._score ?? p._base) };
    if (hasManual) row.is_manual = false;
    if (hasNote)   row.note = '자동선정';

    console.log('  ' + ymd + '  ' + (p.name_ko || p.name_en) +
                ' (#' + p.id + ' · ' + row.score + '점' +
                ' · 작품 ' + (wCount.get(p.id) || 0) +
                ' · 수상 ' + (aCount.get(p.id) || 0) + ')');
    if (!DRY) await sbInsert('daily_self_pr', row);
  }
  if (DRY) console.log('  (--dry · 담지 않았습니다)');
}

/* ════════════════════════════════════════════════════════════
   ② 이달의 음악학교
   ════════════════════════════════════════════════════════════ */

/* 점수 — community/school-month.html 이 그리는 것에 무게를 둡니다.
   ★ intro_ko · photo_urls 는 <b>비워 둡니다</b>.
     화면이 비었을 때 schools.description 과 entity_photos 를 스스로
     찾아 쓰기 때문입니다. 억지로 채우면 저작권 표시가 빠집니다. */
function scoreSchool(s, photoCount) {
  let n = 0;
  const d = len(s.description);
  if (d >= 500) n += 40; else if (d >= 250) n += 30;
  else if (d >= 120) n += 20; else if (d >= 40) n += 8;

  n += Math.min(photoCount, 6) * 7;

  if (has(s.location))    n += 5;
  if (has(s.departments)) n += 8;
  if (has(s.alumni))      n += 8;
  if (has(s.features))    n += 6;
  if (has(s.estab_type))  n += 2;
  if (has(s.founded))     n += 2;
  if (has(s.logo_url))    n += 6;
  if (/^https?:\/\//.test(s.link_home  || '')) n += 3;
  if (/^https?:\/\//.test(s.link_wiki  || '')) n += 2;
  if (/^https?:\/\//.test(s.link_video || '')) n += 5;
  return n;
}

async function pickSchool() {
  const cols = await columnsOf('monthly_school');
  const hasManual = cols.includes('is_manual');

  const hist = await sbAll('monthly_school?select=ym,school_id&order=ym.asc');
  const doneYm  = new Set(hist.map((r) => r.ym));
  const usedSid = new Set(hist.map((r) => r.school_id).filter(Boolean));

  const ym = ONE_YM || THIS_YM;
  if (doneYm.has(ym)) {
    console.log('[이달의 음악학교] ' + ym + ' 은 이미 담겨 있습니다.');
    return;
  }

  const SEL = 'id,name_ko,name_en,location,estab_type,founded,departments,alumni,' +
              'features,logo_url,description,link_home,link_wiki,link_video';
  const schools = await sbAll('schools?select=' + SEL + '&order=id.asc');

  /* 학교 사진 — 로고는 뺍니다(화면 위에 로고가 따로 있습니다) */
  const ph = await sbAll('entity_photos?select=entity_id,kind&entity_type=eq.school' +
                         '&hidden=eq.false&order=entity_id.asc');
  const phCount = new Map();
  ph.forEach((r) => {
    if (r.kind === 'logo') return;
    phCount.set(r.entity_id, (phCount.get(r.entity_id) || 0) + 1);
  });

  const cand = schools
    .filter((s) => has(s.name_ko) && len(s.description) >= 120 && !usedSid.has(s.id))
    .map((s) => ({ ...s, _ph: phCount.get(s.id) || 0 }))
    .map((s) => ({ ...s, _score: scoreSchool(s, s._ph) }))
    .sort((a, b) => b._score - a._score || a.id - b.id);

  console.log('[이달의 음악학교] ' + ym + ' · 새 후보 ' + cand.length + '곳');
  if (!cand.length) {
    console.log('  ■ 후보가 없습니다 — 아무것도 담지 않았습니다.');
    return;
  }

  const s = cand[0];
  console.log('  고름 : ' + s.name_ko + ' (#' + s.id + ' · ' + s._score + '점 · 사진 ' + s._ph + '장)');
  console.log('  다음 후보 : ' + cand.slice(1, 4)
    .map((x) => x.name_ko + '(' + x._score + ')').join(' · '));

  if (DRY) { console.log('  (--dry · 담지 않았습니다)'); return; }

  const row = { ym, school_id: s.id };
  if (hasManual) row.is_manual = false;
  await sbInsert('monthly_school', row);
  console.log('  담았습니다.');
}

/* ════════════════════════════════════════════════════════════ */
async function main() {
  console.log('=== pick-daily · 한국시각 ' + TODAY + (DRY ? ' · DRY' : '') + ' ===');
  if (ONLY !== 'school') await pickPersons();
  if (ONLY !== 'person') await pickSchool();
  console.log('=== 끝 ===');
}

main().catch((e) => { console.error('■ 실패:', e); process.exit(1); });
