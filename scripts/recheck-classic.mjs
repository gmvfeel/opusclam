/* ============================================================
   OPUSCLAM 인물DB 클래식 다시 판정 — scripts/recheck-classic.mjs
   ------------------------------------------------------------
   ★ 무엇을 하나
     이미 담긴 인물을 `scripts/lib/classic.mjs` 로 <b>다시 판정</b>합니다.
     판정 규칙에 구멍이 있어 들어온 대중음악 인물을 찾아냅니다.

   ★ 왜 필요한가 (2026-08-12)
     판정이 「클래식 낱말이 있으면 통과」였는데, <b>대중음악 장르 이름에
     클래식 낱말이 박혀 있었습니다.</b>
       symphonic metal · rock opera · orchestral pop · baroque pop
     심포닉메탈 밴드 보컬이 「장르가 클래식」으로 들어왔습니다.

   ★ 파트너가 이름을 하나씩 볼 필요가 없습니다
     <b>까닭별로 묶어</b>서 보여 줍니다. 까닭이 맞으면 그 묶음을
     통째로 판단하시면 됩니다.
       「대중음악 장르만 있음 — 312명」  ← 이 까닭이 맞나만 보시면 됩니다
     묶음마다 표본을 함께 찍습니다.

   ★★ 두 가지를 <b>절대 섞지 않습니다</b> ★★
     ① 대중음악이라서 빠진 사람      → 지워도 됩니다
     ② 장르·직업·소개문이 모두 빈 사람 → <b>지우지 않습니다</b>
        보강 수집기가 며칠 뒤 채워 줄 사람입니다. 지우면 되살릴 수
        없습니다(차단 목록에 이름조차 남지 않습니다).
        이 사람들은 세어서 알려만 드립니다.

   ★ 지울 때는 차단 목록에 함께 넣습니다
     그러지 않으면 다음 자동수집이 <b>같은 사람을 또 담습니다.</b>

   쓰는 법
     node scripts/recheck-classic.mjs                무엇이 빠질지만 봅니다
     node scripts/recheck-classic.mjs --list         전부 찍습니다
     node scripts/recheck-classic.mjs --why=대중음악  그 까닭만 자세히
     node scripts/recheck-classic.mjs --skip=약함     그 까닭은 지우지 않음
     node scripts/recheck-classic.mjs --rescue        살릴 만한 사람 골라 보기
     node scripts/recheck-classic.mjs --save         실제로 지웁니다
     node scripts/recheck-classic.mjs --save --max=800
         800명이 넘게 빠지면 <b>지우지 않고</b> 멈춥니다

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { checkClassic } from './lib/classic.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SAVE = !!args.save;
const LIST = !!args.list;
const WHY  = typeof args.why === 'string' ? args.why : null;
/* ★★ 2026-08-19 · <b>이 까닭은 빼기</b> (파트너와 겪은 일)
     ─────────────────────────────────────────────────────
   ★ 무엇이 문제였나
     「대중음악 신호가 있고 클래식 근거 약함」 371명을 눈으로 훑어보니
     대부분 Beyoncé·Bob Dylan 같은 대중가수였지만, <b>클래식 지휘자가
     섞여</b> 있었습니다 — 페렌츠 프리차이·샤를 뒤투아·크리스토프
     에셴바흐. 이들이 빠지면 큰 손실입니다.

   ★ 「지우고 나중에 다시 받으면 된다」는 이 경우 <b>통하지 않습니다.</b>
     인물을 담는 길은 위키데이터 수집과 콩쿠르 기록뿐이고, 위키데이터
     수집은 <b>같은 판정 규칙</b>을 쓰므로 다시 걸러집니다. 한 번 지우면
     영영 안 돌아옵니다.

   ★ 그래서 까닭 하나를 통째로 <b>빼고</b> 돌릴 수 있게 했습니다.
     여럿을 뺄 때는 쉼표로 잇습니다 — --skip=약함,재즈 */
const SKIP = (typeof args.skip === 'string' ? args.skip : '')
  .split(',').map(v => v.trim()).filter(Boolean);

/* ★★ 2026-08-19 · <b>살릴 만한 사람 골라 보기</b> (--rescue)
     ─────────────────────────────────────────────────────
   ★ 왜 필요한가
     「대중음악 신호가 있고 클래식 근거 약함」으로 걸린 371명은
     대부분 대중가수지만 <b>클래식 지휘자가 묻혀</b> 있습니다 —
     페렌츠 프리차이·샤를 뒤투아·크리스토프 에셴바흐.
     371명을 눈으로 다 훑는 것은 품이 큽니다.

   ★ 무엇을 하나 — 빠질 사람 가운데 <b>클래식 신호가 또렷한</b>
     사람만 따로 보여 줍니다. 지휘자·오케스트라·오페라 같은 낱말이
     직업·장르·소개문 어디엔가 있는 사람입니다.
     ★ 자동으로 살리지 <b>않습니다.</b> 목록만 보여 주고 판단은
       사람이 합니다 — 잘못 살리면 대중가수가 클래식에 남습니다. */
/* --rescue        클래식 신호가 보이는 사람 (넉넉히)
   --rescue=strong  <b>직업에 지휘자·연주자가 또렷한</b> 사람만 (좁게)
   ★ 넉넉히 보면 목록이 길어 훑기 어렵습니다. 좁게 보면 놓치는 사람이
     생기지만 <b>먼저 확실한 것부터</b> 살리고 나중에 넓히면 됩니다. */
const RESCUE = !!args.rescue;
const STRONG = args.rescue === 'strong';

/* 넉넉한 그물 — 어디엔가 클래식 낱말이 보이면 */
const CLASSIC_SIGN = /(conductor|chef d.orchestre|dirigent|kapellmeister|music director|principal conductor|philharmonic|symphony orchestra|opera house|concertmaster|violinist|cellist|organist|harpsichord|classical music|지휘자|상임지휘|음악감독|교향악단|오케스트라|필하모닉|오페라극장|클래식)/i;

/* 좁은 그물 — <b>직업</b>에 지휘자·클래식 연주자가 또렷할 때만.
   ★ 소개문이나 장르가 아니라 직업만 봅니다. 소개문에 「오케스트라와
     협연했다」가 있다고 클래식 음악인은 아닙니다. */
const CLASSIC_JOB = /\b(conductor|chef d.orchestre|dirigent|kapellmeister|concertmaster|violinist|cellist|violist|organist|harpsichordist|opera singer|classical pianist)\b/i;
const MAX  = typeof args.max === 'string' && /^\d+$/.test(args.max) ? Number(args.max) : 0;

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ★ Supabase 응답은 200줄이 상한입니다.
     limit/offset 을 쿼리로 보내면 어디서 잘렸는지 알 수 없어
     첫 쪽에서 멈춥니다(2026-08-11 사고). Range 헤더를 씁니다.
     0줄일 때만 끝내고, 실제로 받은 수만큼 나아갑니다. */
async function getAll(path) {
  const out = [];
  let from = 0;
  const TAKE = 200;
  for (let guard = 0; guard < 800; guard++) {
    const rows = await rest(path, {
      headers: { Range: from + '-' + (from + TAKE - 1), 'Range-Unit': 'items' }
    });
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    from += rows.length;
    process.stdout.write('   읽는 중 ' + out.length + '명\r');
  }
  process.stdout.write('                              \r');
  return out;
}

function short(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}
function nameOf(p) { return p.name_ko || p.name_en || ('#' + p.id); }

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  인물DB 클래식 다시 판정                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 지웁니다 (--save)\n'
                   : '\n※ 지우지 않고 무엇이 빠질지만 봅니다.\n');
  if (MAX > 0) console.log('※ 상한 ' + MAX + '명 — 넘으면 지우지 않고 멈춥니다\n');

  const rows = await getAll(
    'persons?select=id,name_ko,name_en,wikidata_id,wd_genre,wd_occupation,description,description_en,field'
    + '&order=id.asc');
  console.log('인물 : ' + rows.length + '명        ');

  const groups = new Map();     // 대중음악 근거가 있어 지울 사람
  const hold   = new Map();     // 근거가 없을 뿐인 사람 — 지우지 않습니다
  let ok = 0;
  const noEvidence = [];        // 장르·직업·소개문이 아예 없는 사람

  /* ★★ 2026-08-12 · 「지울 것」과 「사람이 봐야 할 것」을 나눕니다 ★★
     ──────────────────────────────────────────────────────────────
     첫 dry run 이 48명을 골라냈는데 <b>29명이 오판</b>이었습니다.
     오판은 모두 <b>대중음악이라서가 아니라 근거가 모자라서</b> 걸린 것이었습니다 —

       이경선   직업이 `academic` 하나뿐  → 서울대 바이올린 교수
       김택수   직업이 `singer` 하나뿐    → 작곡가 Texu Kim
       김남윤   소개문 「바이올린 연주자」 → 규칙이 「바이올리니스트」만 알았음

     ▶ 원칙을 세웁니다 —
       <b>대중음악 근거가 있는 사람만 지웁니다.</b>
       근거가 <b>없는</b> 것은 대중음악이라는 뜻이 아닙니다.
       보강 수집기가 며칠 뒤 장르·소개문을 채워 주면 그때 제대로 판정됩니다.
       지우면 되살릴 수 없으니 기다리는 편이 낫습니다. */
  const POP_REASONS = ['대중음악 장르만 있음', '대중음악 전용 직업',
                       '대중음악을 겸한 작곡·제작', '소개문이 대중음악'];

  for (const p of rows) {
    const c = checkClassic(p);
    if (c.ok) { ok++; continue; }
    if (c.noEvidence) { noEvidence.push(p); continue; }
    /* ★ --skip 으로 뺀 까닭은 「사람이 봐야 할 것」으로 돌립니다 —
         지우지 않고 그대로 둡니다. */
    const skipped = SKIP.some(k => c.why.indexOf(k) >= 0);
    const box = (!skipped && POP_REASONS.includes(c.why)) ? groups : hold;
    if (!box.has(c.why)) box.set(c.why, []);
    box.get(c.why).push(p);
  }

  const drop = [...groups.values()].flat();
  const holdList = [...hold.values()].flat();

  /* ★ 살릴 만한 사람 — <b>빠질 사람과 남겨 둔 사람 모두</b>에서 찾습니다.
       --skip 으로 빼 둔 371명도 언젠가는 갈라야 하므로 함께 봅니다. */
  const rescue = !RESCUE ? []
    : STRONG
      /* 좁게 — 직업에 지휘자·연주자가 또렷한 사람만 */
      ? [...drop, ...holdList].filter(p => CLASSIC_JOB.test(p.wd_occupation || ''))
      /* 넉넉히 — 어디엔가 클래식 낱말이 보이면 */
      : [...drop, ...holdList].filter(p => CLASSIC_SIGN.test(
          [p.wd_occupation, p.wd_genre, p.description, p.description_en]
            .filter(Boolean).join(' ')));

  console.log('\n── 다시 판정한 결과 ──');
  console.log('   클래식으로 남음      : ' + ok + '명');
  console.log('   ★ 지울 것           : ' + drop.length + '명   (대중음악 근거가 있는 사람)');
  console.log('   사람이 봐야 할 것    : ' + holdList.length + '명   (근거가 모자랄 뿐 — 지우지 않습니다)');
  if (SKIP.length) console.log('   ※ 일부러 뺀 까닭      : ' + SKIP.join(' · ') + '  (--skip)');
  console.log('   판정 못 함          : ' + noEvidence.length + '명'
              + '   (장르·직업·소개문이 모두 빔 — 지우지 않습니다)');

  if (RESCUE) {
    console.log('\n── ★ 살릴 만한 사람 ' + (STRONG ? '(직업이 또렷함 · 좁게)' : '(클래식 신호가 보임 · 넉넉히)')
      + ' — ' + rescue.length + '명 ──');
    console.log('   ※ 자동으로 살리지 않습니다. 눈으로 보고 정하십시오.');
    console.log('   ※ 살릴 사람은 sql/weak-01-B-rescue.sql 에 이름을 적어 넣습니다.');
    rescue.slice(0, 80).forEach((p, i) => {
      console.log('\n   ' + String(i + 1).padStart(3) + '. ' + nameOf(p)
        + (p.wikidata_id ? '  [' + p.wikidata_id + ']' : ''));
      if (p.wd_occupation) console.log('        직업 : ' + short(p.wd_occupation, 84));
      if (p.wd_genre)      console.log('        장르 : ' + short(p.wd_genre, 84));
      const d = p.description || p.description_en;
      if (d)               console.log('        소개 : ' + short(d, 84));
    });
    if (rescue.length > 80) console.log('\n   … 그리고 ' + (rescue.length - 80) + '명');
  }

  console.log('\n── 지울 묶음 (대중음악 근거 있음) ──');
  console.log('   ※ 이름을 하나씩 보지 마시고 「까닭이 맞는지」만 보십시오.');
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  if (!sorted.length) console.log('   없습니다.');
  for (const [why, list] of sorted) {
    console.log('\n   ● ' + why + ' — ' + list.length + '명');
    const n = (LIST || (WHY && why.indexOf(WHY) >= 0)) ? list.length : Math.min(8, list.length);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      console.log('       ' + String(i + 1).padStart(4) + '. ' + nameOf(p)
        + (p.wikidata_id ? '  [' + p.wikidata_id + ']' : ''));
      if (p.wd_genre)      console.log('             장르 : ' + short(p.wd_genre, 90));
      if (p.wd_occupation) console.log('             직업 : ' + short(p.wd_occupation, 90));
      if (!p.wd_genre && !p.wd_occupation)
        console.log('             소개 : ' + short(p.description || p.description_en, 90));
    }
    if (n < list.length) console.log('       … 그리고 ' + (list.length - n) + '명 (전부 보시려면 --list)');
  }

  /* ★ 지우지 않는 묶음 — 왜 남기는지 함께 알립니다 */
  if (holdList.length) {
    console.log('\n── 사람이 봐야 할 묶음 (지우지 않습니다) ──');
    console.log('   근거가 모자라 판정하지 못한 사람입니다. 대중음악이라는 뜻이 아닙니다.');
    console.log('   보강 수집기가 장르·소개문을 채우면 다음 실행에서 제대로 갈립니다.');
    for (const [why, list] of [...hold.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log('\n   ○ ' + why + ' — ' + list.length + '명');
      const n = LIST ? list.length : Math.min(10, list.length);
      for (let i = 0; i < n; i++) {
        const p = list[i];
        console.log('       ' + String(i + 1).padStart(4) + '. ' + nameOf(p)
          + (p.wikidata_id ? '  [' + p.wikidata_id + ']' : '')
          + (p.wd_occupation ? '  · ' + short(p.wd_occupation, 60) : ''));
        if (!p.wd_occupation && (p.description || p.description_en))
          console.log('             소개 : ' + short(p.description || p.description_en, 80));
      }
      if (n < list.length) console.log('       … 그리고 ' + (list.length - n) + '명');
    }
  }

  if (noEvidence.length) {
    console.log('\n── 판정 못 한 사람 표본 (지우지 않습니다) ──');
    noEvidence.slice(0, 5).forEach((p, i) => {
      console.log('   ' + (i + 1) + '. ' + nameOf(p) + (p.wikidata_id ? '  [' + p.wikidata_id + ']' : ''));
    });
    if (noEvidence.length > 5) console.log('   … 그리고 ' + (noEvidence.length - 5) + '명');
  }

  if (!SAVE) {
    console.log('\n※ 아무것도 지우지 않았습니다.');
    console.log('  ' + drop.length + '명을 지우시려면 --save 를 주십시오.');
  console.log('  (사람이 봐야 할 ' + holdList.length + '명과 판정 못 한 ' + noEvidence.length + '명은 --save 를 주셔도 지우지 않습니다)');
    return;
  }
  if (!drop.length) { console.log('\n지울 것이 없습니다.'); return; }

  /* 울타리 — 규칙이 잘못됐을 때 대량 삭제를 막습니다 */
  if (drop.length > rows.length * 0.3) {
    console.error('\n★ 멈췄습니다 — 전체의 30%가 넘는 ' + drop.length + '명이 빠집니다.');
    console.error('  규칙이 잘못됐을 수 있습니다. 사람이 먼저 확인해 주십시오.');
    process.exit(1);
  }
  if (MAX > 0 && drop.length > MAX) {
    console.error('\n★ 멈췄습니다 — ' + drop.length + '명이 빠지는데 상한은 ' + MAX + '명입니다.');
    console.error('  아무것도 지우지 않았습니다. 위 묶음을 먼저 확인해 주십시오.');
    process.exit(1);
  }

  /* ★★ 차단 목록에 <b>먼저</b> 올리고 그다음 지웁니다 ★★
       거꾸로 하면 차단이 실패했을 때 사람은 사라지고 차단은 안 되어
       다음 수집에서 또 들어옵니다.

     ★ 칸은 `wikidata_id` <b>하나만</b> 넣습니다.
       admin/modern-clean.html 에 적혀 있는 그대로입니다 —
       「없는 칸을 넣으면 통째로 실패해서 차단이 안 된 채로 멈춥니다.」
       (reason 칸이 있는 것처럼 보이지만 인물DB 차단도 이 칸 하나만 씁니다)

     ★ 같은 번호가 두 번 들어가면 「한 줄을 두 번 건드릴 수 없다」는
       오류가 납니다. 겹치는 것을 먼저 걷어내고 묶어서 보냅니다.

     ★ 위키데이터 번호가 없는 사람은 막을 길이 없습니다.
       이름으로 막는 표(person_block)가 따로 있으나 이름 차단은
       동명이인을 함께 막으므로 여기서는 쓰지 않고 <b>세어서 알려만</b>
       드립니다. 그 사람은 지우면 다음 수집에 다시 들어올 수 있습니다. */
  const seen = new Set();
  const qids = [];
  let noQid = 0;
  for (const p of drop) {
    const q = p.wikidata_id ? String(p.wikidata_id).trim() : '';
    if (!q) { noQid++; continue; }
    if (seen.has(q)) continue;
    seen.add(q); qids.push(q);
  }
  console.log('\n── 차단 목록에 올리는 중 ──');
  console.log('   위키데이터 번호 있음 : ' + qids.length + '건');
  if (noQid) console.log('   번호 없음           : ' + noQid + '명  (막을 수 없습니다 — 다시 들어올 수 있습니다)');

  if (qids.length) {
    /* 200건씩 묶어 보냅니다 */
    let bok = 0;
    try {
      for (let i = 0; i < qids.length; i += 200) {
        const chunk = qids.slice(i, i + 200).map(q => ({ wikidata_id: q }));
        await rest('blocklist?on_conflict=wikidata_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(chunk)
        });
        bok += chunk.length;
        process.stdout.write('   ' + bok + '/' + qids.length + '\r');
      }
      console.log('   올림 ' + bok + '건            ');
    } catch (e) {
      console.error('\n★ 멈췄습니다 — 차단 목록에 올리지 못했습니다.');
      console.error('  ' + short(e.message, 200));
      console.error('  막지 못한 채 지우면 다음 수집이 같은 사람을 또 담습니다.');
      console.error('  아무도 지우지 않았습니다.');
      process.exit(1);
    }
  }

  console.log('\n── 지우는 중 ──');
  let dok = 0, dng = 0;
  for (const p of drop) {
    try {
      await rest('persons?id=eq.' + p.id, {
        method: 'DELETE', headers: { Prefer: 'return=minimal' }
      });
      dok++;
    } catch (e) {
      dng++;
      if (dng <= 10) console.log('   [실패] #' + p.id + ' ' + nameOf(p) + ' — ' + short(e.message, 110));
    }
    if (dok % 100 === 0) process.stdout.write('   ' + dok + '/' + drop.length + '\r');
  }
  console.log('   끝 · 지움 ' + dok + '명 · 실패 ' + dng + '명        ');

  /* 전후를 숫자로 보여 줍니다 */
  console.log('\n인물DB : ' + rows.length + '명 → ' + (rows.length - dok) + '명  (' + dok + '명 줄었습니다)');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
