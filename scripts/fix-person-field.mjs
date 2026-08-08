/* ============================================================
   OPUSCLAM 인물 분야 다시 판정 — scripts/fix-person-field.mjs
   ------------------------------------------------------------
   왜 필요한가
     분야를 정하는 규칙이 <b>규칙 순서</b>를 따르고 있었습니다.
     `composer` 가 맨 앞이라, 직업 목록에 composer 가 하나라도 있으면
     무조건 「작곡」이 되었습니다.

       마우리치오 폴리니
         concertmaster, pianist, musician, conductor, composer
         → 「작곡」  ✗   (피아니스트입니다)

     이용자가 데이터 신고로 알려 주셔서 드러났습니다.
     위키데이터는 연주자에게도 composer 를 자주 붙이므로
     <b>같은 오류가 많이 있을 것</b>입니다. 한 명만 고치면 신고가 계속 옵니다.

   무엇을 하나
     scripts/lib/field.mjs 의 <b>고친 규칙</b>으로 다시 판정해서,
     지금 값과 다른 사람을 보여 줍니다.

   ★ 첫 실행은 담지 않고 보기만 합니다 (기본값)
   ★ 빈칸을 채우지 않습니다 — 이미 값이 있는데 <b>틀린 것</b>만 고칩니다
     (빈칸 채우기는 enrich-persons.mjs 가 합니다)
   ★ field 칸만 고칩니다. PATCH 로 지정한 칸만 보냅니다.
     (어제 upsert 가 행 전체를 null 로 덮은 사고를 되풀이하지 않습니다)

   쓰는 법
     node scripts/fix-person-field.mjs                   무엇이 바뀔지만 봅니다
     node scripts/fix-person-field.mjs --list            바뀔 사람을 전부 찍습니다
     node scripts/fix-person-field.mjs --save            실제로 고칩니다
     node scripts/fix-person-field.mjs --only=작곡       지금 값이 '작곡'인 것만
     node scripts/fix-person-field.mjs --fill            빈칸도 함께 채웁니다

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)
   ============================================================ */

import { guessField } from './lib/field.mjs';

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
const FILL = !!args.fill;
const ONLY = typeof args.only === 'string' ? args.only : null;

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

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
   끝냄은 0줄일 때만, offset 은 실제로 받은 수만큼, order 에 id 필수. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
    if (off % 2000 === 0) process.stdout.write('   읽는 중 ' + off + '명\r');
  }
  return out;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  인물 분야 다시 판정                         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 고칩니다 (--save)\n'
                   : '\n※ 고치지 않고 무엇이 바뀔지만 봅니다.\n');
  if (FILL) console.log('※ 빈칸도 함께 채웁니다 (--fill)\n');
  if (ONLY) console.log('※ 지금 값이 「' + ONLY + '」 인 사람만 봅니다\n');

  let path = 'persons?select=id,name_ko,name_en,field,wd_occupation'
           + '&wd_occupation=not.is.null&order=id.asc';
  if (ONLY) path += '&field=eq.' + encodeURIComponent(ONLY);

  const rows = await getAll(path);
  console.log('직업이 적힌 인물 : ' + rows.length + '명        ');

  const change = [];
  const fill = [];
  let same = 0, cannot = 0;

  for (const p of rows) {
    const got = guessField(p.wd_occupation);
    const cur = (p.field == null ? '' : String(p.field)).trim();

    if (!got) { cannot++; continue; }
    if (!cur) { fill.push({ ...p, to: got }); continue; }
    if (got === cur) { same++; continue; }
    change.push({ ...p, to: got });
  }

  console.log('\n── 다시 판정한 결과 ──');
  console.log('   그대로            : ' + same + '명');
  console.log('   ★ 바뀔 것        : ' + change.length + '명');
  console.log('   빈칸을 채울 수 있음: ' + fill.length + '명' + (FILL ? ' (함께 고칩니다)' : ' (--fill 을 붙이면 함께)'));
  console.log('   정할 수 없음      : ' + cannot + '명');

  /* 어떻게 바뀌는지 묶어서 보여 줍니다 */
  const pair = new Map();
  for (const c of change) {
    const k = (c.field || '(빈칸)') + ' → ' + c.to;
    pair.set(k, (pair.get(k) || 0) + 1);
  }
  if (pair.size) {
    console.log('\n── 어떻게 바뀌나 ──');
    [...pair.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));
  }

  const show = LIST ? change.length : 25;
  if (change.length) {
    console.log('\n── ' + (LIST ? '바뀔 사람 전부' : '표본 25명') + ' ──');
    if (!LIST && change.length > 25) console.log('   ※ 전부 보시려면 --list 를 붙이십시오.');
    change.slice(0, show).forEach((c, i) => {
      console.log('   ' + String(i + 1).padStart(4) + '. '
        + (c.name_ko || c.name_en || ('#' + c.id))
        + '   ' + (c.field || '(빈칸)') + ' → ' + c.to);
      console.log('         ' + String(c.wd_occupation || '').slice(0, 90));
    });
  }

  const todo = FILL ? change.concat(fill) : change;

  if (!SAVE) {
    console.log('\n※ 아무것도 고치지 않았습니다.');
    console.log('  ' + todo.length + '명을 고치시려면 --save 를 붙여 주십시오.');
    return;
  }
  if (!todo.length) {
    console.log('\n고칠 것이 없습니다.');
    return;
  }

  console.log('\n── 고치는 중 ──');
  let ok = 0, ng = 0;
  for (const c of todo) {
    try {
      /* ★ field 칸만 보냅니다. 다른 칸은 건드리지 않습니다. */
      await rest('persons?id=eq.' + c.id, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ field: c.to })
      });
      ok++;
    } catch (e) {
      ng++;
      console.log('   [실패] #' + c.id + ' ' + (c.name_ko || '') + ' — ' + (e.message || '').slice(0, 100));
    }
    if (ok % 50 === 0) process.stdout.write('   ' + ok + '/' + todo.length + '\r');
  }
  console.log('   끝 · 고침 ' + ok + '명 · 실패 ' + ng + '명        ');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
